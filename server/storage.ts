import { 
  type User, 
  type InsertUser,
  type PriceData,
  type InsertPriceData,
  type TechnicalIndicators,
  type InsertTechnicalIndicators,
  type TradingSignal,
  type InsertTradingSignal,
  type Trade,
  type InsertTrade,
  type BacktestResult,
  type InsertBacktestResult,
  type LivePriceUpdate,
  type ConfidenceScore,
  type RiskMetrics,
  users, priceData, technicalIndicators, tradingSignals, trades, backtestResults
} from "@shared/schema";
import { randomUUID } from "crypto";
import { db } from "./db";
import { eq, desc, and } from "drizzle-orm";

export interface IStorage {
  // User management
  getUser(id: string): Promise<User | undefined>;
  getUserByUsername(username: string): Promise<User | undefined>;
  createUser(user: InsertUser): Promise<User>;
  
  // Price data management
  insertPriceData(data: InsertPriceData): Promise<PriceData>;
  getPriceData(symbol: string, timeframe: string, limit?: number): Promise<PriceData[]>;
  getLatestPrice(symbol: string): Promise<PriceData | undefined>;
  
  // Technical indicators
  insertTechnicalIndicators(indicators: InsertTechnicalIndicators): Promise<TechnicalIndicators>;
  getTechnicalIndicators(priceDataId: string): Promise<TechnicalIndicators | undefined>;
  getLatestIndicators(symbol: string): Promise<TechnicalIndicators | undefined>;
  
  // Trading signals
  insertTradingSignal(signal: InsertTradingSignal): Promise<TradingSignal>;
  getActiveSignals(symbol: string): Promise<TradingSignal[]>;
  getRecentSignals(symbol: string, limit?: number): Promise<TradingSignal[]>;
  updateSignalStatus(id: string, isActive: boolean): Promise<void>;
  
  // Trades
  insertTrade(trade: InsertTrade): Promise<Trade>;
  getActiveTrades(symbol: string): Promise<Trade[]>;
  getRecentTrades(symbol: string, limit?: number): Promise<Trade[]>;
  updateTrade(id: string, updates: Partial<Trade>): Promise<void>;
  
  // Backtest results
  insertBacktestResult(result: InsertBacktestResult): Promise<BacktestResult>;
  getBacktestResults(limit?: number): Promise<BacktestResult[]>;
  
  // Real-time data
  updateCurrentPrice(priceUpdate: LivePriceUpdate): void;
  getCurrentPrice(): LivePriceUpdate | undefined;
  updateCurrentConfidence(confidence: ConfidenceScore): void;
  getCurrentConfidence(): ConfidenceScore | undefined;
}

class Storage implements IStorage {
  private currentPrice: LivePriceUpdate | undefined;
  private currentConfidence: ConfidenceScore | undefined;

  // User management
  async getUser(id: string): Promise<User | undefined> {
    const result = await db.select().from(users).where(eq(users.id, id)).limit(1);
    return result[0];
  }

  async getUserByUsername(username: string): Promise<User | undefined> {
    const result = await db.select().from(users).where(eq(users.username, username)).limit(1);
    return result[0];
  }

  async createUser(user: InsertUser): Promise<User> {
    const result = await db.insert(users).values({
      id: randomUUID(),
      ...user
    }).returning();
    return result[0];
  }

  // Price data management
  async insertPriceData(data: InsertPriceData): Promise<PriceData> {
    console.log("Storage: insertPriceData called with price:", data.close);
    const result = await db.insert(priceData).values({
      id: randomUUID(),
      ...data
    }).returning();
    return result[0];
  }

  async getPriceData(symbol: string, timeframe: string, limit: number = 100): Promise<PriceData[]> {
    const result = await db.select()
      .from(priceData)
      .where(and(
        eq(priceData.symbol, symbol),
        eq(priceData.timeframe, timeframe)
      ))
      .orderBy(desc(priceData.timestamp))
      .limit(limit);
    return result;
  }

  async getLatestPrice(symbol: string): Promise<PriceData | undefined> {
    const result = await db.select()
      .from(priceData)
      .where(eq(priceData.symbol, symbol))
      .orderBy(desc(priceData.timestamp))
      .limit(1);
    return result[0];
  }

  // Technical indicators
  async insertTechnicalIndicators(indicators: InsertTechnicalIndicators): Promise<TechnicalIndicators> {
    const result = await db.insert(technicalIndicators).values({
      id: randomUUID(),
      timestamp: new Date(),
      ...indicators
    }).returning();
    return result[0];
  }

  async getTechnicalIndicators(priceDataId: string): Promise<TechnicalIndicators | undefined> {
    const result = await db.select()
      .from(technicalIndicators)
      .where(eq(technicalIndicators.priceDataId, priceDataId))
      .limit(1);
    return result[0];
  }

  async getLatestIndicators(symbol: string): Promise<TechnicalIndicators | undefined> {
    // This requires joining with priceData to filter by symbol
    const result = await db.select()
      .from(technicalIndicators)
      .orderBy(desc(technicalIndicators.timestamp))
      .limit(1);
    return result[0];
  }

  // Trading signals
  async insertTradingSignal(signal: InsertTradingSignal): Promise<TradingSignal> {
    const result = await db.insert(tradingSignals).values({
      id: randomUUID(),
      timestamp: new Date(),
      isActive: true,
      ...signal
    }).returning();
    return result[0];
  }

  async getActiveSignals(symbol: string): Promise<TradingSignal[]> {
    const result = await db.select()
      .from(tradingSignals)
      .where(and(
        eq(tradingSignals.symbol, symbol),
        eq(tradingSignals.isActive, true)
      ))
      .orderBy(desc(tradingSignals.timestamp));
    return result;
  }

  async getRecentSignals(symbol: string, limit: number = 20): Promise<TradingSignal[]> {
    const result = await db.select()
      .from(tradingSignals)
      .where(eq(tradingSignals.symbol, symbol))
      .orderBy(desc(tradingSignals.timestamp))
      .limit(limit);
    return result;
  }

  async updateSignalStatus(id: string, isActive: boolean): Promise<void> {
    await db.update(tradingSignals)
      .set({ isActive })
      .where(eq(tradingSignals.id, id));
  }

  // Trades
  async insertTrade(trade: InsertTrade): Promise<Trade> {
    const result = await db.insert(trades).values({
      id: randomUUID(),
      entryTime: new Date(),
      status: "OPEN",
      ...trade
    }).returning();
    return result[0];
  }

  async getActiveTrades(symbol: string): Promise<Trade[]> {
    const result = await db.select()
      .from(trades)
      .where(and(
        eq(trades.symbol, symbol),
        eq(trades.status, "OPEN")
      ))
      .orderBy(desc(trades.entryTime));
    return result;
  }

  async getRecentTrades(symbol: string, limit: number = 50): Promise<Trade[]> {
    const result = await db.select()
      .from(trades)
      .where(eq(trades.symbol, symbol))
      .orderBy(desc(trades.entryTime))
      .limit(limit);
    return result;
  }

  async updateTrade(id: string, updates: Partial<Trade>): Promise<void> {
    await db.update(trades)
      .set(updates)
      .where(eq(trades.id, id));
  }

  // Backtest results
  async insertBacktestResult(result: InsertBacktestResult): Promise<BacktestResult> {
    const inserted = await db.insert(backtestResults).values({
      id: randomUUID(),
      createdAt: new Date(),
      ...result
    }).returning();
    return inserted[0];
  }

  async getBacktestResults(limit: number = 10): Promise<BacktestResult[]> {
    const result = await db.select()
      .from(backtestResults)
      .orderBy(desc(backtestResults.createdAt))
      .limit(limit);
    return result;
  }

  // Real-time data
  updateCurrentPrice(priceUpdate: LivePriceUpdate): void {
    console.log("Storage: updateCurrentPrice called with:", priceUpdate.price);
    this.currentPrice = priceUpdate;
  }

  getCurrentPrice(): LivePriceUpdate | undefined {
    return this.currentPrice;
  }

  updateCurrentConfidence(confidence: ConfidenceScore): void {
    this.currentConfidence = confidence;
  }

  getCurrentConfidence(): ConfidenceScore | undefined {
    return this.currentConfidence;
  }

  // Helper methods for dashboard data
  async getDashboardData() {
    const [signals, trades, recentPrice, confidence] = await Promise.all([
      this.getRecentSignals("BTCUSD", 10),
      this.getRecentTrades("BTCUSD", 10), 
      this.getLatestPrice("BTCUSD"),
      Promise.resolve(this.getCurrentConfidence())
    ]);

    return {
      signals,
      trades,
      price: recentPrice,
      confidence,
      summary: {
        totalSignals: signals.length,
        activeSignals: signals.filter(s => s.isActive).length,
        totalTrades: trades.length,
        activeTrades: trades.filter(t => t.status === 'OPEN').length
      }
    };
  }

  // Mock data generation for empty sections
  async generateMockDataIfEmpty() {
    const recentSignals = await this.getRecentSignals("BTCUSD", 1);
    
    // If no signals exist, create some sample ones for demo purposes
    if (recentSignals.length === 0) {
      const mockSignals = [
        {
          symbol: "BTCUSD",
          signalType: "BUY" as const,
          confidence: 75,
          price: 65000,
          momentumScore: 0.7,
          volumeScore: 0.8,
          trendScore: 0.6,
          volatilityScore: 0.5,
          reasoning: "Strong bullish momentum detected"
        },
        {
          symbol: "BTCUSD", 
          signalType: "SELL" as const,
          confidence: 65,
          price: 64500,
          momentumScore: 0.3,
          volumeScore: 0.4,
          trendScore: 0.2,
          volatilityScore: 0.8,
          reasoning: "Overbought conditions"
        }
      ];

      for (const signal of mockSignals) {
        await this.insertTradingSignal(signal);
      }
    }
  }
}

export const storage = new Storage();