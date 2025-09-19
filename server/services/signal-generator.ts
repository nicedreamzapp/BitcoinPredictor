import { storage } from '../storage';
import { tradingEngine } from './trading-engine';

interface SignalResult {
  success: boolean;
  signal?: {
    id: string;
    type: 'BUY' | 'SELL' | 'HOLD';
    direction: string;
    strength: number;
    confidence: number;
    reason: string;
    price: number;
    timestamp: Date;
    metadata: any;
  };
  error?: string;
  dataHealth?: {
    status: 'healthy' | 'warning' | 'error';
    message: string;
    dataPoints: number;
  };
}

export class SignalGenerator {
  private isRunning = false;
  private intervalId: NodeJS.Timeout | null = null;
  private lastSignalTime: Date | null = null;
  private readonly SIGNAL_COOLDOWN = 30000;

  start() {
    if (this.isRunning) return;
    
    console.log('Starting signal generator...');
    this.isRunning = true;
    
    this.intervalId = setInterval(async () => {
      await this.generateSignals();
    }, 30000);
  }

  stop() {
    if (this.intervalId) {
      clearInterval(this.intervalId);
      this.intervalId = null;
    }
    this.isRunning = false;
    console.log('Signal generator stopped');
  }

  private async generateSignals() {
    try {
      const currentPrice = storage.getCurrentPrice();
      if (!currentPrice) {
        console.log('No current price available for signal generation');
        return;
      }

      const priceHistory = await storage.getPriceData("BTCUSD", "5m", 50);
      if (priceHistory.length < 20) {
        console.log(`Not enough price data for signal generation`);
        return;
      }

      const prices = priceHistory.map(p => p.close).reverse();
      const volumes = priceHistory.map(p => p.volume).reverse();
      const confidenceScore = await tradingEngine.calculateConfidenceScore(prices, volumes);

      const signal = await tradingEngine.generateTradingSignal(confidenceScore, currentPrice.price);
      
      if (signal) {
        console.log("Inserting signal:", { symbol: "BTCUSD", signalType: signal.type, direction: signal.direction, confidence: signal.confidence });
        
        await storage.insertTradingSignal({
          symbol: "BTCUSD",
          signalType: signal.type,
          direction: signal.direction,
          confidence: signal.confidence,
          price: currentPrice.price,
          momentumScore: confidenceScore.momentum,
          volumeScore: confidenceScore.volume,
          trendScore: confidenceScore.trend,
          volatilityScore: confidenceScore.volatility
        });
        
        console.log(`Generated ${signal.direction} signal with ${signal.confidence}% confidence`);
      } else {
        console.log(`Confidence too low for signal generation`);
      }
    } catch (error) {
      console.error("Error generating signals:", error.message);
    }
  }
}

export const signalGenerator = new SignalGenerator();

export async function generateTradingSignal(priceData: any[]) {
  return signalGenerator.generateSignal(priceData);
}
