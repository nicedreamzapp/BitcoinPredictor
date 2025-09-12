import { storage } from "../storage";
import { type LivePriceUpdate, type InsertPriceData } from "@shared/schema";

export class PriceFeedService {
  private isRunning = false;
  private intervalId: NodeJS.Timeout | null = null;
  
  // Simulated Bitcoin price for development
  private currentPrice = 43487.25;
  private lastUpdate = Date.now();

  start(): void {
    if (this.isRunning) return;

    this.isRunning = true;
    console.log("Starting Bitcoin price feed...");

    // Update price every 1 second
    this.intervalId = setInterval(() => {
      this.generatePriceUpdate();
    }, 1000);

    // Store OHLCV data every 5 minutes
    setInterval(() => {
      this.storePriceData();
    }, 5 * 60 * 1000);
  }

  stop(): void {
    if (!this.isRunning) return;

    this.isRunning = false;
    if (this.intervalId) {
      clearInterval(this.intervalId);
      this.intervalId = null;
    }
    console.log("Bitcoin price feed stopped.");
  }

  private generatePriceUpdate(): void {
    // Simulate realistic Bitcoin price movements
    const volatility = 0.002; // 0.2% volatility per update
    const randomChange = (Math.random() - 0.5) * 2 * volatility;
    
    // Add some trending behavior
    const trend = Math.sin(Date.now() / 1000000) * 0.0005;
    
    const priceChange = this.currentPrice * (randomChange + trend);
    const newPrice = Math.max(1000, this.currentPrice + priceChange); // Minimum $1000

    const change24h = newPrice - this.currentPrice;
    const changePercent24h = (change24h / this.currentPrice) * 100;

    // Generate realistic volume (between 500M and 2B)
    const baseVolume = 1200000000; // 1.2B base volume
    const volumeVariation = (Math.random() - 0.5) * 0.4; // ±20% variation
    const volume24h = baseVolume * (1 + volumeVariation);

    const priceUpdate: LivePriceUpdate = {
      symbol: "BTCUSD",
      price: newPrice,
      change24h,
      changePercent24h,
      volume24h,
      high24h: Math.max(newPrice, this.getHigh24h()),
      low24h: Math.min(newPrice, this.getLow24h()),
      timestamp: Date.now()
    };

    this.currentPrice = newPrice;
    this.lastUpdate = Date.now();

    // Store the update
    storage.updateCurrentPrice(priceUpdate);
  }

  private storePriceData(): void {
    const currentPriceData = storage.getCurrentPrice();
    if (!currentPriceData) return;

    // Generate OHLCV data for 5-minute candle
    const priceData: InsertPriceData = {
      symbol: "BTCUSD",
      timestamp: new Date(),
      open: this.currentPrice * (0.999 + Math.random() * 0.002), // Slight variation
      high: this.currentPrice * (1 + Math.random() * 0.003),
      low: this.currentPrice * (1 - Math.random() * 0.003),
      close: this.currentPrice,
      volume: currentPriceData.volume24h / (24 * 12), // Approximate 5-min volume
      timeframe: "5m"
    };

    storage.insertPriceData(priceData);
  }

  private getHigh24h(): number {
    // Simple simulation - in real app, track actual high
    return this.currentPrice * 1.05;
  }

  private getLow24h(): number {
    // Simple simulation - in real app, track actual low  
    return this.currentPrice * 0.95;
  }

  getCurrentPrice(): LivePriceUpdate | undefined {
    return storage.getCurrentPrice();
  }

  getHistoricalPrices(symbol: string, timeframe: string, limit: number): Promise<any[]> {
    return storage.getPriceData(symbol, timeframe, limit);
  }

  isServiceRunning(): boolean {
    return this.isRunning;
  }
}

export const priceFeedService = new PriceFeedService();
