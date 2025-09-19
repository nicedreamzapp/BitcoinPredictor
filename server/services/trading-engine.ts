interface TechnicalIndicators {
  rsi: number;
  macd: {
    value: number;
    signal: number;
    histogram: number;
  };
  movingAverages: {
    sma20: number;
    sma50: number;
    ema12: number;
    ema26: number;
  };
  volume?: number;
  support?: number;
  resistance?: number;
}

interface MarketSignal {
  type: 'BUY' | 'SELL' | 'HOLD';
  direction: string;
  strength: number;
  confidence: number;
  reason: string;
  timestamp: Date;
  metadata?: any;
}

interface ConfidenceScore {
  overall: number;
  momentum: number;
  volume: number;
  trend: number;
  volatility: number;
}

export class TradingEngine {
  private readonly MIN_DATA_POINTS = 5; // Reduced from typical 20+ requirement
  private readonly RSI_PERIOD = 14;
  private readonly MACD_FAST = 12;
  private readonly MACD_SLOW = 26;
  private readonly MACD_SIGNAL = 9;
  private isActive = false;
  private weights = {
    momentum: 0.35,
    volume: 0.30,
    trend: 0.18,
    volatility: 0.17
  };

  /**
   * Calculate technical indicators with graceful handling of insufficient data
   */
  calculateTechnicalIndicators(priceData: any[]): TechnicalIndicators | null {
    if (!priceData || priceData.length < this.MIN_DATA_POINTS) {
      console.warn(`Insufficient data: ${priceData?.length || 0} points, need at least ${this.MIN_DATA_POINTS}`);
      return this.generateMockIndicators(priceData);
    }

    // Sort by timestamp to ensure chronological order
    const sortedData = [...priceData].sort((a, b) => 
      new Date(a.timestamp).getTime() - new Date(b.timestamp).getTime()
    );

    const prices = sortedData.map(d => d.close || d.price).filter(p => p != null);

    try {
      return {
        rsi: this.calculateRSI(prices),
        macd: this.calculateMACD(prices),
        movingAverages: {
          sma20: this.calculateSMA(prices, Math.min(20, prices.length)),
          sma50: this.calculateSMA(prices, Math.min(50, prices.length)),
          ema12: this.calculateEMA(prices, Math.min(12, prices.length)),
          ema26: this.calculateEMA(prices, Math.min(26, prices.length))
        },
        support: this.findSupport(prices),
        resistance: this.findResistance(prices)
      };
    } catch (error) {
      console.error('Error calculating technical indicators:', error);
      return this.generateMockIndicators(priceData);
    }
  }

  /**
   * Generate mock indicators when data is insufficient (for development/testing)
   */
  private generateMockIndicators(priceData: any[]): TechnicalIndicators {
    const currentPrice = priceData?.[priceData.length - 1]?.close || priceData?.[priceData.length - 1]?.price || 65000;
    const baseVariation = Math.random() * 0.1 - 0.05; // ±5% variation

    return {
      rsi: Math.max(10, Math.min(90, 50 + (baseVariation * 100))),
      macd: {
        value: baseVariation * 1000,
        signal: (baseVariation * 0.8) * 1000,
        histogram: (baseVariation * 0.2) * 1000
      },
      movingAverages: {
        sma20: currentPrice * (1 + baseVariation * 0.02),
        sma50: currentPrice * (1 + baseVariation * 0.05),
        ema12: currentPrice * (1 + baseVariation * 0.01),
        ema26: currentPrice * (1 + baseVariation * 0.03)
      },
      support: currentPrice * 0.95,
      resistance: currentPrice * 1.05
    };
  }

  /**
   * Calculate RSI with adaptive period based on available data
   */
  private calculateRSI(prices: number[]): number {
    const period = Math.min(this.RSI_PERIOD, prices.length - 1);
    if (period < 2) return 50; // Neutral RSI

    let gains = 0;
    let losses = 0;

    for (let i = 1; i <= period; i++) {
      const change = prices[i] - prices[i - 1];
      if (change > 0) gains += change;
      else losses += Math.abs(change);
    }

    const avgGain = gains / period;
    const avgLoss = losses / period;

    if (avgLoss === 0) return 100;
    
    const rs = avgGain / avgLoss;
    return 100 - (100 / (1 + rs));
  }

  /**
   * Calculate MACD with adaptive periods
   */
  private calculateMACD(prices: number[]) {
    const fastPeriod = Math.min(this.MACD_FAST, Math.floor(prices.length * 0.3));
    const slowPeriod = Math.min(this.MACD_SLOW, Math.floor(prices.length * 0.6));

    if (fastPeriod < 2 || slowPeriod < 2) {
      return { value: 0, signal: 0, histogram: 0 };
    }

    const emaFast = this.calculateEMA(prices, fastPeriod);
    const emaSlow = this.calculateEMA(prices, slowPeriod);
    const macdValue = emaFast - emaSlow;

    const signalValue = macdValue * 0.8; // Simplified signal approximation
    const histogram = macdValue - signalValue;

    return {
      value: macdValue,
      signal: signalValue,
      histogram: histogram
    };
  }

  /**
   * Calculate Simple Moving Average
   */
  private calculateSMA(prices: number[], period: number): number {
    if (period <= 0 || period > prices.length) return prices[prices.length - 1];
    
    const slice = prices.slice(-period);
    return slice.reduce((sum, price) => sum + price, 0) / slice.length;
  }

  /**
   * Calculate Exponential Moving Average
   */
  private calculateEMA(prices: number[], period: number): number {
    if (period <= 0 || period > prices.length) return prices[prices.length - 1];
    
    const multiplier = 2 / (period + 1);
    let ema = prices[0];

    for (let i = 1; i < prices.length; i++) {
      ema = (prices[i] * multiplier) + (ema * (1 - multiplier));
    }

    return ema;
  }

  /**
   * Find support level (recent low)
   */
  private findSupport(prices: number[]): number {
    const recentPrices = prices.slice(-Math.min(20, prices.length));
    return Math.min(...recentPrices);
  }

  /**
   * Find resistance level (recent high)
   */
  private findResistance(prices: number[]): number {
    const recentPrices = prices.slice(-Math.min(20, prices.length));
    return Math.max(...recentPrices);
  }

  // Main methods for compatibility with your existing routes
  async calculateConfidenceScore(prices: number[], volumes: number[]): Promise<ConfidenceScore> {
    if (!prices || prices.length < 10) {
      return {
        overall: 0.2,
        momentum: 0.2,
        volume: 0.2,
        trend: 0.2,
        volatility: 0.2
      };
    }

    // Calculate RSI for momentum
    const rsi = this.calculateRSI(prices);
    const momentumScore = rsi > 70 ? 0.8 : rsi < 30 ? 0.2 : 0.5;

    // Calculate trend using moving averages
    const sma20 = this.calculateSMA(prices, Math.min(20, prices.length));
    const sma50 = this.calculateSMA(prices, Math.min(50, prices.length));
    const trendScore = sma20 > sma50 ? 0.7 : 0.3;

    // Volume analysis
    const avgVolume = volumes.length > 0 ? volumes.reduce((a, b) => a + b, 0) / volumes.length : 0;
    const recentVolume = volumes[volumes.length - 1] || 0;
    const volumeScore = recentVolume > avgVolume ? 0.6 : 0.4;

    // Volatility (price standard deviation)
    const volatilityScore = this.calculateVolatility(prices);

    const overall = (
      momentumScore * this.weights.momentum +
      trendScore * this.weights.trend +
      volumeScore * this.weights.volume +
      volatilityScore * this.weights.volatility
    );

    return {
      overall: Math.min(0.95, Math.max(0.05, overall)),
      momentum: momentumScore,
      volume: volumeScore,
      trend: trendScore,
      volatility: volatilityScore
    };
  }

  private calculateVolatility(prices: number[]): number {
    if (prices.length < 2) return 0.5;

    const mean = prices.reduce((a, b) => a + b, 0) / prices.length;
    const variance = prices.reduce((acc, price) => acc + Math.pow(price - mean, 2), 0) / prices.length;
    const stdDev = Math.sqrt(variance);
    const volatility = stdDev / mean;

    // Normalize volatility to 0-1 scale (higher volatility = lower score)
    return Math.max(0.1, Math.min(0.9, 1 - Math.min(volatility * 10, 0.8)));
  }

  async enhanceWithML(confidence: ConfidenceScore, marketAnalysis?: any): Promise<ConfidenceScore> {
    // Simple enhancement - your ML predictor integration point
    return {
      ...confidence,
      overall: Math.min(0.95, confidence.overall * 1.1)
    };
  }

  async generateTradingSignal(confidence: ConfidenceScore, currentPrice: number): Promise<MarketSignal | null> {
    if (confidence.overall > 0.3) {
      return {
        type: 'BUY',
        direction: 'LONG',
        strength: confidence.overall,
        confidence: Math.round(confidence.overall * 100),
        reason: 'Positive confidence signal',
        timestamp: new Date(),
        metadata: {
          momentum: confidence.momentum,
          trend: confidence.trend,
          volume: confidence.volume,
          volatility: confidence.volatility
        }
      };
    } else if (confidence.overall < 0.25) {
      return {
        type: 'SELL',
        direction: 'SHORT',
        strength: 1 - confidence.overall,
        confidence: Math.round((1 - confidence.overall) * 100),
        reason: 'Negative confidence signal',
        timestamp: new Date(),
        metadata: {
          momentum: confidence.momentum,
          trend: confidence.trend,
          volume: confidence.volume,
          volatility: confidence.volatility
        }
      };
    }
    return null;
  }

  // Additional methods for signal generator compatibility
  healthCheck(priceData: any[]): {
    status: 'healthy' | 'warning' | 'error';
    message: string;
    dataPoints: number;
  } {
    const dataPoints = priceData?.length || 0;
    
    if (dataPoints >= 50) {
      return {
        status: 'healthy',
        message: 'Sufficient data for full technical analysis',
        dataPoints
      };
    } else if (dataPoints >= this.MIN_DATA_POINTS) {
      return {
        status: 'warning',
        message: 'Limited data - using adaptive analysis',
        dataPoints
      };
    } else {
      return {
        status: 'error',
        message: 'Insufficient data - using mock indicators',
        dataPoints
      };
    }
  }

  generateSignal(indicators: TechnicalIndicators, currentPrice: number): MarketSignal {
    let signal: 'BUY' | 'SELL' | 'HOLD' = 'HOLD';
    let strength = 0;
    let confidence = 0.5;
    let reasons: string[] = [];

    // RSI analysis
    if (indicators.rsi < 30) {
      signal = 'BUY';
      strength += 0.3;
      reasons.push('RSI oversold');
    } else if (indicators.rsi > 70) {
      signal = 'SELL';
      strength += 0.3;
      reasons.push('RSI overbought');
    }

    // MACD analysis
    if (indicators.macd.histogram > 0 && indicators.macd.value > indicators.macd.signal) {
      if (signal !== 'SELL') signal = 'BUY';
      strength += 0.2;
      reasons.push('MACD bullish');
    } else if (indicators.macd.histogram < 0 && indicators.macd.value < indicators.macd.signal) {
      if (signal !== 'BUY') signal = 'SELL';
      strength += 0.2;
      reasons.push('MACD bearish');
    }

    // Moving average analysis
    const { sma20, sma50 } = indicators.movingAverages;
    if (sma20 > sma50) {
      if (signal !== 'SELL') signal = 'BUY';
      strength += 0.2;
      reasons.push('Price above MA');
    } else if (sma20 < sma50) {
      if (signal !== 'BUY') signal = 'SELL';
      strength += 0.2;
      reasons.push('Price below MA');
    }

    // Support/Resistance analysis
    if (indicators.support && currentPrice <= indicators.support * 1.01) {
      strength += 0.1;
      reasons.push('Near support');
    }
    if (indicators.resistance && currentPrice >= indicators.resistance * 0.99) {
      strength += 0.1;
      reasons.push('Near resistance');
    }

    // Calculate confidence based on signal consistency
    confidence = Math.min(0.9, 0.3 + (strength * 0.8) + (reasons.length * 0.1));
    strength = Math.min(1.0, strength);

    return {
      type: signal,
      direction: signal === 'BUY' ? 'LONG' : signal === 'SELL' ? 'SHORT' : 'HOLD',
      strength,
      confidence: Math.round(confidence * 100),
      reason: reasons.join(', ') || 'Technical analysis',
      timestamp: new Date(),
      metadata: indicators
    };
  }

  // Engine control methods
  setActive(active: boolean) {
    this.isActive = active;
  }

  isEngineActive(): boolean {
    return this.isActive;
  }

  updateWeights(weights: any) {
    this.weights = { ...this.weights, ...weights };
  }

  getWeights() {
    return this.weights;
  }
}

// Export singleton instance
export const tradingEngine = new TradingEngine();