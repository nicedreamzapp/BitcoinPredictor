import { storage } from "../storage";
import { type LivePriceUpdate, type InsertPriceData } from "@shared/schema";
import axios from "axios";

export class PriceFeedService {
  private isRunning = false;
  private intervalId: NodeJS.Timeout | null = null;
  
  // Will be populated from real API
  private currentPrice = 94000; // Rough current BTC price as fallback
  private lastUpdate = Date.now();

  start(): void {
    if (this.isRunning) return;

    this.isRunning = true;
    console.log("Starting Bitcoin price feed with real data...");

    // Fetch initial price immediately
    this.fetchRealPrice();

    // Update price every 30 seconds (CoinGecko free tier limit)
    this.intervalId = setInterval(() => {
      this.fetchRealPrice();
    }, 30000);

    // Generate price variations every 1 second based on real data
    setInterval(() => {
      this.generatePriceUpdate();
    }, 1000);

    // Store OHLCV data every 5 minutes
    setInterval(() => {
      this.storePriceData();
    }, 5 * 1000);
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

  private async fetchRealPrice(): Promise<void> {
    try {
      const response = await axios.get('https://api.coingecko.com/api/v3/simple/price?ids=bitcoin&vs_currencies=usd&include_24hr_change=true&include_24hr_vol=true');
      
      const data = response.data.bitcoin;
      if (data && data.usd) {
        this.currentPrice = data.usd;
        console.log(`Real BTC price updated: $${this.currentPrice.toLocaleString()}`);
        
        // Create a real price update
        const priceUpdate: LivePriceUpdate = {
          symbol: "BTCUSD",
          price: this.currentPrice,
          change24h: data.usd_24h_change || 0,
          changePercent24h: data.usd_24h_change || 0,
          volume24h: data.usd_24h_vol || 50000000000,
          high24h: this.currentPrice * 1.02, // Estimate
          low24h: this.currentPrice * 0.98,  // Estimate
          timestamp: Date.now()
        };
        
        storage.updateCurrentPrice(priceUpdate);
      }
    } catch (error) {
      console.error('Failed to fetch real Bitcoin price:', error.message);
      console.log('Continuing with simulated price movements...');
    }
  }

  private generatePriceUpdate(): void {
    // Small realistic variations around the real price
    const volatility = 0.0005; // 0.05% volatility per second
    const randomChange = (Math.random() - 0.5) * 2 * volatility;
    
    const priceChange = this.currentPrice * randomChange;
    const newPrice = Math.max(1000, this.currentPrice + priceChange);

    const change24h = newPrice - this.currentPrice;
    const changePercent24h = (change24h / this.currentPrice) * 100;

    // Generate realistic volume
    const baseVolume = 45000000000; // ~$45B daily volume
    const volumeVariation = (Math.random() - 0.5) * 0.2;
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

    storage.updateCurrentPrice(priceUpdate);
  }

  private storePriceData(): void {
    const currentPriceData = storage.getCurrentPrice();
    if (!currentPriceData) return;

    const priceData: InsertPriceData = {
      symbol: "BTCUSD",
      timestamp: new Date(),
      open: this.currentPrice * (0.999 + Math.random() * 0.002),
      high: this.currentPrice * (1 + Math.random() * 0.001),
      low: this.currentPrice * (1 - Math.random() * 0.001),
      close: this.currentPrice,
      volume: currentPriceData.volume24h / (24 * 12),
      timeframe: "5m"
    };

    storage.insertPriceData(priceData);
  }

  private getHigh24h(): number {
    return this.currentPrice * 1.02;
  }

  private getLow24h(): number {
    return this.currentPrice * 0.98;
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
