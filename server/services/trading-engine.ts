import OpenAI from "openai";
import { storage } from "../storage";
import { type ConfidenceScore, type TradingSignal, type InsertTradingSignal } from "@shared/schema";

// the newest OpenAI model is "gpt-5" which was released August 7, 2025. do not change this unless explicitly requested by the user
const openai = new OpenAI({ 
  apiKey: process.env.OPENAI_API_KEY || process.env.OPENAI_API_KEY_ENV_VAR || "sk-test-key"
});

export interface TradingMetrics {
  momentum: number;
  volume: number;
  trend: number;
  volatility: number;
}

export interface StrategyWeights {
  momentum: number; // 35%
  volume: number;   // 30%
  trend: number;    // 18%
  volatility: number; // 17%
}

export class TradingEngine {
  private weights: StrategyWeights = {
    momentum: 0.35,
    volume: 0.30,
    trend: 0.18,
    volatility: 0.17
  };

  private isActive = true;

  async calculateTechnicalIndicators(prices: number[], volumes: number[]) {
    if (prices.length < 200) {
      throw new Error("Insufficient data for technical analysis");
    }

    // Calculate EMAs
    const ema50 = this.calculateEMA(prices, 50);
    const ema200 = this.calculateEMA(prices, 200);

    // Calculate StochRSI
    const rsi = this.calculateRSI(prices, 14);
    const stochRsi = this.calculateStochRSI(rsi, 14);

    // Calculate volume analysis
    const volumeMA = this.calculateSMA(volumes, 20);
    const volumeSpike = volumes[volumes.length - 1] > volumeMA * 1.8;

    // Detect PVSRA signals
    const pvsraSignal = this.detectPVSRASignal(prices, volumes);

    return {
      ema50: ema50[ema50.length - 1],
      ema200: ema200[ema200.length - 1],
      stochRsiK: stochRsi.k[stochRsi.k.length - 1],
      stochRsiD: stochRsi.d[stochRsi.d.length - 1],
      volumeSpike,
      pvsraSignal,
      volumeMA
    };
  }

  async calculateConfidenceScore(prices: number[], volumes: number[]): Promise<ConfidenceScore> {
    const indicators = await this.calculateTechnicalIndicators(prices, volumes);
    
    // Calculate individual component scores
    const momentumScore = this.calculateMomentumScore(indicators);
    const volumeScore = this.calculateVolumeScore(indicators, volumes);
    const trendScore = this.calculateTrendScore(indicators);
    const volatilityScore = this.calculateVolatilityScore(prices);

    // Weighted confidence calculation
    const longConfidence = Math.max(0, Math.min(100, 
      (momentumScore * this.weights.momentum + 
       volumeScore * this.weights.volume + 
       trendScore * this.weights.trend + 
       volatilityScore * this.weights.volatility) * 100
    ));

    const shortConfidence = 100 - longConfidence;

    const confidenceScore: ConfidenceScore = {
      longConfidence,
      shortConfidence,
      momentumScore,
      volumeScore,
      trendScore,
      volatilityScore,
      timestamp: Date.now()
    };

    // Update storage with latest confidence
    storage.updateCurrentConfidence(confidenceScore);

    return confidenceScore;
  }

  async enhanceWithML(baseScore: ConfidenceScore, marketContext: any): Promise<ConfidenceScore> {
    // Check if OpenAI API key is available
    if (!process.env.OPENAI_API_KEY || process.env.OPENAI_API_KEY === "sk-test-key") {
      // Return base score with slight mathematical enhancement based on market context
      const marketStrength = marketContext?.volatilityForecast || 0.5;
      const confidenceAdjustment = (marketStrength - 0.5) * 10; // ±5% adjustment
      
      return {
        ...baseScore,
        longConfidence: Math.max(0, Math.min(100, baseScore.longConfidence + confidenceAdjustment)),
        shortConfidence: Math.max(0, Math.min(100, baseScore.shortConfidence - confidenceAdjustment)),
      };
    }

    try {
      const prompt = `Analyze Bitcoin trading conditions and enhance confidence scores.
        
        Current analysis:
        - Long Confidence: ${baseScore.longConfidence}%
        - Short Confidence: ${baseScore.shortConfidence}%
        - Momentum Score: ${baseScore.momentumScore}
        - Volume Score: ${baseScore.volumeScore}
        - Trend Score: ${baseScore.trendScore}
        - Volatility Score: ${baseScore.volatilityScore}
        
        Market Context: ${JSON.stringify(marketContext)}
        
        Provide enhanced confidence scores based on current market conditions, news sentiment, and technical patterns.
        Response format: {"longConfidence": number, "shortConfidence": number, "reasoning": "string"}`;

      const response = await openai.chat.completions.create({
        model: "gpt-5",
        messages: [
          {
            role: "system",
            content: "You are an expert Bitcoin trading analyst. Enhance technical analysis with market intelligence and provide confidence scores between 0-100."
          },
          {
            role: "user",
            content: prompt
          }
        ],
        response_format: { type: "json_object" },
      });

      const enhancement = JSON.parse(response.choices[0].message.content || "{}");
      
      return {
        ...baseScore,
        longConfidence: Math.max(0, Math.min(100, enhancement.longConfidence || baseScore.longConfidence)),
        shortConfidence: Math.max(0, Math.min(100, enhancement.shortConfidence || baseScore.shortConfidence)),
      };

    } catch (error) {
      console.error("ML enhancement failed, using fallback:", error);
      return baseScore;
    }
  }

  async generateTradingSignal(confidenceScore: ConfidenceScore, currentPrice: number): Promise<TradingSignal | null> {
    if (!this.isActive) return null;

    const threshold = 65; // Minimum confidence threshold
    let signalType: "LONG" | "SHORT" | null = null;
    let confidence = 0;

    if (confidenceScore.longConfidence >= threshold && confidenceScore.longConfidence > confidenceScore.shortConfidence) {
      signalType = "LONG";
      confidence = confidenceScore.longConfidence;
    } else if (confidenceScore.shortConfidence >= threshold && confidenceScore.shortConfidence > confidenceScore.longConfidence) {
      signalType = "SHORT";
      confidence = confidenceScore.shortConfidence;
    }

    if (!signalType) return null;

    const stopLossPercent = signalType === "LONG" ? 0.02 : -0.02; // 2% stop loss
    const takeProfitPercent = signalType === "LONG" ? 0.045 : -0.045; // 4.5% take profit

    const signalData: InsertTradingSignal = {
      symbol: "BTCUSD",
      signalType,
      confidence: confidence / 100,
      price: currentPrice,
      stopLoss: currentPrice * (1 + stopLossPercent),
      takeProfit: currentPrice * (1 + takeProfitPercent),
      reasoning: `${signalType} signal generated with ${confidence.toFixed(1)}% confidence`,
      momentumScore: confidenceScore.momentumScore,
      volumeScore: confidenceScore.volumeScore,
      trendScore: confidenceScore.trendScore,
      volatilityScore: confidenceScore.volatilityScore,
    };

    return storage.insertTradingSignal(signalData);
  }

  private calculateEMA(prices: number[], period: number): number[] {
    const alpha = 2 / (period + 1);
    const ema: number[] = [];
    ema[0] = prices[0];

    for (let i = 1; i < prices.length; i++) {
      ema[i] = alpha * prices[i] + (1 - alpha) * ema[i - 1];
    }

    return ema;
  }

  private calculateSMA(values: number[], period: number): number {
    const slice = values.slice(-period);
    return slice.reduce((sum, val) => sum + val, 0) / slice.length;
  }

  private calculateRSI(prices: number[], period: number): number[] {
    const changes = prices.slice(1).map((price, i) => price - prices[i]);
    const gains = changes.map(change => change > 0 ? change : 0);
    const losses = changes.map(change => change < 0 ? -change : 0);
    
    let avgGain = this.calculateSMA(gains.slice(0, period), period);
    let avgLoss = this.calculateSMA(losses.slice(0, period), period);
    
    const rsi: number[] = [];
    
    for (let i = period; i < changes.length; i++) {
      avgGain = ((avgGain * (period - 1)) + gains[i]) / period;
      avgLoss = ((avgLoss * (period - 1)) + losses[i]) / period;
      
      const rs = avgGain / avgLoss;
      rsi.push(100 - (100 / (1 + rs)));
    }
    
    return rsi;
  }

  private calculateStochRSI(rsi: number[], period: number): { k: number[], d: number[] } {
    const k: number[] = [];
    
    for (let i = period - 1; i < rsi.length; i++) {
      const slice = rsi.slice(i - period + 1, i + 1);
      const min = Math.min(...slice);
      const max = Math.max(...slice);
      k.push(((rsi[i] - min) / (max - min)) * 100);
    }
    
    // Calculate %D as 3-period SMA of %K
    const d: number[] = [];
    for (let i = 2; i < k.length; i++) {
      d.push((k[i] + k[i-1] + k[i-2]) / 3);
    }
    
    return { k, d };
  }

  private calculateMomentumScore(indicators: any): number {
    const stochSignal = indicators.stochRsiK > indicators.stochRsiD && indicators.stochRsiK < 80 ? 0.8 : 0.2;
    return stochSignal;
  }

  private calculateVolumeScore(indicators: any, volumes: number[]): number {
    const volumeSignal = indicators.volumeSpike && indicators.pvsraSignal === "BULL" ? 0.9 : 0.3;
    return volumeSignal;
  }

  private calculateTrendScore(indicators: any): number {
    const trendSignal = indicators.ema50 > indicators.ema200 ? 0.8 : 0.2;
    return trendSignal;
  }

  private calculateVolatilityScore(prices: number[]): number {
    const returns = prices.slice(1).map((price, i) => Math.log(price / prices[i]));
    const volatility = Math.sqrt(returns.reduce((sum, ret) => sum + ret * ret, 0) / returns.length);
    return Math.min(1, volatility * 10); // Normalize volatility
  }

  private detectPVSRASignal(prices: number[], volumes: number[]): "BULL" | "BEAR" | "NEUTRAL" {
    const currentPrice = prices[prices.length - 1];
    const prevPrice = prices[prices.length - 2];
    const currentVolume = volumes[volumes.length - 1];
    const avgVolume = this.calculateSMA(volumes.slice(-20), 20);

    if (currentVolume > avgVolume * 1.8) {
      return currentPrice > prevPrice ? "BULL" : "BEAR";
    }

    return "NEUTRAL";
  }

  setActive(active: boolean): void {
    this.isActive = active;
  }

  isEngineActive(): boolean {
    return this.isActive;
  }

  updateWeights(newWeights: Partial<StrategyWeights>): void {
    this.weights = { ...this.weights, ...newWeights };
  }

  getWeights(): StrategyWeights {
    return { ...this.weights };
  }
}

export const tradingEngine = new TradingEngine();
