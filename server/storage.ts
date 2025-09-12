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
  type RiskMetrics
} from "@shared/schema";
import { randomUUID } from "crypto";

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

export class MemStorage implements IStorage {
  private users: Map<string, User>;
  private priceData: Map<string, PriceData>;
  private technicalIndicators: Map<string, TechnicalIndicators>;
  private tradingSignals: Map<string, TradingSignal>;
  private trades: Map<string, Trade>;
  private backtestResults: Map<string, BacktestResult>;
  
  // Real-time data storage
  private currentPrice: LivePriceUpdate | undefined;
  private currentConfidence: ConfidenceScore | undefined;
  private riskMetrics: RiskMetrics | undefined;

  constructor() {
    this.users = new Map();
    this.priceData = new Map();
    this.technicalIndicators = new Map();
    this.tradingSignals = new Map();
    this.trades = new Map();
    this.backtestResults = new Map();
  }

  // User methods
  async getUser(id: string): Promise<User | undefined> {
    return this.users.get(id);
  }

  async getUserByUsername(username: string): Promise<User | undefined> {
    return Array.from(this.users.values()).find(user => user.username === username);
  }

  async createUser(insertUser: InsertUser): Promise<User> {
    const id = randomUUID();
    const user: User = { ...insertUser, id };
    this.users.set(id, user);
    return user;
  }

  // Price data methods
  async insertPriceData(data: InsertPriceData): Promise<PriceData> {
    const id = randomUUID();
    const priceData: PriceData = { 
      symbol: data.symbol || "BTCUSD",
      ...data, 
      id 
    };
    this.priceData.set(id, priceData);
    return priceData;
  }

  async getPriceData(symbol: string, timeframe: string, limit = 100): Promise<PriceData[]> {
    return Array.from(this.priceData.values())
      .filter(data => data.symbol === symbol && data.timeframe === timeframe)
      .sort((a, b) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime())
      .slice(0, limit);
  }

  async getLatestPrice(symbol: string): Promise<PriceData | undefined> {
    const prices = Array.from(this.priceData.values())
      .filter(data => data.symbol === symbol)
      .sort((a, b) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime());
    return prices[0];
  }

  // Technical indicators methods
  async insertTechnicalIndicators(indicators: InsertTechnicalIndicators): Promise<TechnicalIndicators> {
    const id = randomUUID();
    const techIndicators: TechnicalIndicators = { 
      volume: indicators.volume || null,
      ema50: indicators.ema50 || null,
      ema200: indicators.ema200 || null,
      stochRsiK: indicators.stochRsiK || null,
      stochRsiD: indicators.stochRsiD || null,
      pvsraSignal: indicators.pvsraSignal || null,
      supportLevel: indicators.supportLevel || null,
      resistanceLevel: indicators.resistanceLevel || null,
      ...indicators, 
      id 
    };
    this.technicalIndicators.set(id, techIndicators);
    return techIndicators;
  }

  async getTechnicalIndicators(priceDataId: string): Promise<TechnicalIndicators | undefined> {
    return Array.from(this.technicalIndicators.values())
      .find(indicators => indicators.priceDataId === priceDataId);
  }

  async getLatestIndicators(symbol: string): Promise<TechnicalIndicators | undefined> {
    const latestPrice = await this.getLatestPrice(symbol);
    if (!latestPrice) return undefined;
    return this.getTechnicalIndicators(latestPrice.id);
  }

  // Trading signals methods
  async insertTradingSignal(signal: InsertTradingSignal): Promise<TradingSignal> {
    const id = randomUUID();
    const tradingSignal: TradingSignal = { 
      symbol: signal.symbol || "BTCUSD",
      stopLoss: signal.stopLoss || null,
      takeProfit: signal.takeProfit || null,
      reasoning: signal.reasoning || null,
      ...signal, 
      id, 
      timestamp: new Date(),
      isActive: true 
    };
    this.tradingSignals.set(id, tradingSignal);
    return tradingSignal;
  }

  async getActiveSignals(symbol: string): Promise<TradingSignal[]> {
    return Array.from(this.tradingSignals.values())
      .filter(signal => signal.symbol === symbol && signal.isActive)
      .sort((a, b) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime());
  }

  async getRecentSignals(symbol: string, limit = 10): Promise<TradingSignal[]> {
    return Array.from(this.tradingSignals.values())
      .filter(signal => signal.symbol === symbol)
      .sort((a, b) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime())
      .slice(0, limit);
  }

  async updateSignalStatus(id: string, isActive: boolean): Promise<void> {
    const signal = this.tradingSignals.get(id);
    if (signal) {
      signal.isActive = isActive;
      this.tradingSignals.set(id, signal);
    }
  }

  // Trades methods
  async insertTrade(trade: InsertTrade): Promise<Trade> {
    const id = randomUUID();
    const newTrade: Trade = { 
      symbol: trade.symbol || "BTCUSD",
      stopLoss: trade.stopLoss || null,
      takeProfit: trade.takeProfit || null,
      exitPrice: trade.exitPrice || null,
      exitTime: trade.exitTime || null,
      pnl: trade.pnl || null,
      ...trade, 
      id, 
      entryTime: new Date(),
      status: "OPEN"
    };
    this.trades.set(id, newTrade);
    return newTrade;
  }

  async getActiveTrades(symbol: string): Promise<Trade[]> {
    return Array.from(this.trades.values())
      .filter(trade => trade.symbol === symbol && trade.status === "OPEN")
      .sort((a, b) => new Date(b.entryTime).getTime() - new Date(a.entryTime).getTime());
  }

  async getRecentTrades(symbol: string, limit = 20): Promise<Trade[]> {
    return Array.from(this.trades.values())
      .filter(trade => trade.symbol === symbol)
      .sort((a, b) => new Date(b.entryTime).getTime() - new Date(a.entryTime).getTime())
      .slice(0, limit);
  }

  async updateTrade(id: string, updates: Partial<Trade>): Promise<void> {
    const trade = this.trades.get(id);
    if (trade) {
      Object.assign(trade, updates);
      this.trades.set(id, trade);
    }
  }

  // Backtesting methods
  async insertBacktestResult(result: InsertBacktestResult): Promise<BacktestResult> {
    const id = randomUUID();
    const backtestResult: BacktestResult = { 
      ...result, 
      id, 
      createdAt: new Date() 
    };
    this.backtestResults.set(id, backtestResult);
    return backtestResult;
  }

  async getBacktestResults(limit = 10): Promise<BacktestResult[]> {
    return Array.from(this.backtestResults.values())
      .sort((a, b) => new Date(b.createdAt!).getTime() - new Date(a.createdAt!).getTime())
      .slice(0, limit);
  }

  // Real-time data methods
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

export const storage = new MemStorage();
