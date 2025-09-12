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
  
  // Backtesting
  insertBacktestResult(result: InsertBacktestResult): Promise<BacktestResult>;
  getBacktestResults(limit?: number): Promise<BacktestResult[]>;
  
  // Real-time data
  getCurrentPrice(): LivePriceUpdate | undefined;
  updateCurrentPrice(update: LivePriceUpdate): void;
  getCurrentConfidence(): ConfidenceScore | undefined;
  updateCurrentConfidence(confidence: ConfidenceScore): void;
  getRiskMetrics(): RiskMetrics | undefined;
  updateRiskMetrics(metrics: RiskMetrics): void;
}

export class DatabaseStorage implements IStorage {
  // Real-time data storage (keep in memory for performance)
  private currentPrice: LivePriceUpdate | undefined;
  private currentConfidence: ConfidenceScore | undefined;
  private riskMetrics: RiskMetrics | undefined;

  constructor() {
    // Real-time data stays in memory for fast access
  }

  // User methods
  async getUser(id: string): Promise<User | undefined> {
    const [user] = await db.select().from(users).where(eq(users.id, id));
    return user || undefined;
  }

  async getUserByUsername(username: string): Promise<User | undefined> {
    const [user] = await db.select().from(users).where(eq(users.username, username));
    return user || undefined;
  }

  async createUser(insertUser: InsertUser): Promise<User> {
    const [user] = await db.insert(users).values(insertUser).returning();
    return user;
  }

  // Price data methods
  async insertPriceData(data: InsertPriceData): Promise<PriceData> {
    const [price] = await db.insert(priceData).values({
      symbol: data.symbol || "BTCUSD",
      ...data
    }).returning();
    return price;
  }

  async getPriceData(symbol: string, timeframe: string, limit = 100): Promise<PriceData[]> {
    const prices = await db.select()
      .from(priceData)
      .where(and(eq(priceData.symbol, symbol), eq(priceData.timeframe, timeframe)))
      .orderBy(desc(priceData.timestamp))
      .limit(limit);
    return prices;
  }

  async getLatestPrice(symbol: string): Promise<PriceData | undefined> {
    const [price] = await db.select()
      .from(priceData)
      .where(eq(priceData.symbol, symbol))
      .orderBy(desc(priceData.timestamp))
      .limit(1);
    return price || undefined;
  }

  // Technical indicators methods
  async insertTechnicalIndicators(indicators: InsertTechnicalIndicators): Promise<TechnicalIndicators> {
    const [indicator] = await db.insert(technicalIndicators).values({
      volume: indicators.volume || null,
      ema50: indicators.ema50 || null,
      ema200: indicators.ema200 || null,
      stochRsiK: indicators.stochRsiK || null,
      stochRsiD: indicators.stochRsiD || null,
      pvsraSignal: indicators.pvsraSignal || null,
      supportLevel: indicators.supportLevel || null,
      resistanceLevel: indicators.resistanceLevel || null,
      ...indicators
    }).returning();
    return indicator;
  }

  async getTechnicalIndicators(priceDataId: string): Promise<TechnicalIndicators | undefined> {
    const [indicator] = await db.select()
      .from(technicalIndicators)
      .where(eq(technicalIndicators.priceDataId, priceDataId));
    return indicator || undefined;
  }

  async getLatestIndicators(symbol: string): Promise<TechnicalIndicators | undefined> {
    const latestPrice = await this.getLatestPrice(symbol);
    if (!latestPrice) return undefined;
    return this.getTechnicalIndicators(latestPrice.id);
  }

  // Trading signals methods
  async insertTradingSignal(signal: InsertTradingSignal): Promise<TradingSignal> {
    const [tradingSignal] = await db.insert(tradingSignals).values({
      symbol: signal.symbol || "BTCUSD",
      stopLoss: signal.stopLoss || null,
      takeProfit: signal.takeProfit || null,
      reasoning: signal.reasoning || null,
      timestamp: new Date(),
      isActive: true,
      ...signal
    }).returning();
    return tradingSignal;
  }

  async getActiveSignals(symbol: string): Promise<TradingSignal[]> {
    const signals = await db.select()
      .from(tradingSignals)
      .where(and(eq(tradingSignals.symbol, symbol), eq(tradingSignals.isActive, true)))
      .orderBy(desc(tradingSignals.timestamp));
    return signals;
  }

  async getRecentSignals(symbol: string, limit = 10): Promise<TradingSignal[]> {
    const signals = await db.select()
      .from(tradingSignals)
      .where(eq(tradingSignals.symbol, symbol))
      .orderBy(desc(tradingSignals.timestamp))
      .limit(limit);
    return signals;
  }

  async updateSignalStatus(id: string, isActive: boolean): Promise<void> {
    await db.update(tradingSignals)
      .set({ isActive })
      .where(eq(tradingSignals.id, id));
  }

  // Trades methods
  async insertTrade(trade: InsertTrade): Promise<Trade> {
    const [newTrade] = await db.insert(trades).values({
      symbol: trade.symbol || "BTCUSD",
      stopLoss: trade.stopLoss || null,
      takeProfit: trade.takeProfit || null,
      exitPrice: trade.exitPrice || null,
      exitTime: trade.exitTime || null,
      pnl: trade.pnl || null,
      entryTime: new Date(),
      status: "OPEN",
      ...trade
    }).returning();
    return newTrade;
  }

  async getActiveTrades(symbol: string): Promise<Trade[]> {
    const activeTrades = await db.select()
      .from(trades)
      .where(and(eq(trades.symbol, symbol), eq(trades.status, "OPEN")))
      .orderBy(desc(trades.entryTime));
    return activeTrades;
  }

  async getRecentTrades(symbol: string, limit = 20): Promise<Trade[]> {
    const recentTrades = await db.select()
      .from(trades)
      .where(eq(trades.symbol, symbol))
      .orderBy(desc(trades.entryTime))
      .limit(limit);
    return recentTrades;
  }

  async updateTrade(id: string, updates: Partial<Trade>): Promise<void> {
    await db.update(trades)
      .set(updates)
      .where(eq(trades.id, id));
  }

  // Backtesting methods
  async insertBacktestResult(result: InsertBacktestResult): Promise<BacktestResult> {
    const [backtestResult] = await db.insert(backtestResults).values({
      createdAt: new Date(),
      ...result
    }).returning();
    return backtestResult;
  }

  async getBacktestResults(limit = 10): Promise<BacktestResult[]> {
    const results = await db.select()
      .from(backtestResults)
      .orderBy(desc(backtestResults.createdAt))
      .limit(limit);
    return results;
  }

  // Real-time data methods (kept in memory for performance)
  getCurrentPrice(): LivePriceUpdate | undefined {
    return this.currentPrice;
  }

  updateCurrentPrice(update: LivePriceUpdate): void {
    this.currentPrice = update;
  }

  getCurrentConfidence(): ConfidenceScore | undefined {
    return this.currentConfidence;
  }

  updateCurrentConfidence(confidence: ConfidenceScore): void {
    this.currentConfidence = confidence;
  }

  getRiskMetrics(): RiskMetrics | undefined {
    return this.riskMetrics;
  }

  updateRiskMetrics(metrics: RiskMetrics): void {
    this.riskMetrics = metrics;
  }
}

export const storage = new DatabaseStorage();