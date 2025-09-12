import { sql } from "drizzle-orm";
import { pgTable, text, varchar, real, integer, timestamp, boolean, jsonb } from "drizzle-orm/pg-core";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod";

export const users = pgTable("users", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  username: text("username").notNull().unique(),
  password: text("password").notNull(),
});

export const priceData = pgTable("price_data", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  symbol: text("symbol").notNull().default("BTCUSD"),
  timestamp: timestamp("timestamp").notNull(),
  open: real("open").notNull(),
  high: real("high").notNull(),
  low: real("low").notNull(),
  close: real("close").notNull(),
  volume: real("volume").notNull(),
  timeframe: text("timeframe").notNull(), // 5m, 15m, 1h, 4h, 1d
});

export const technicalIndicators = pgTable("technical_indicators", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  priceDataId: varchar("price_data_id").notNull(),
  timestamp: timestamp("timestamp").notNull(),
  ema50: real("ema50"),
  ema200: real("ema200"),
  stochRsiK: real("stoch_rsi_k"),
  stochRsiD: real("stoch_rsi_d"),
  volume: real("volume"),
  pvsraSignal: text("pvsra_signal"), // BULL, BEAR, NEUTRAL
  supportLevel: real("support_level"),
  resistanceLevel: real("resistance_level"),
});

export const tradingSignals = pgTable("trading_signals", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  timestamp: timestamp("timestamp").notNull(),
  symbol: text("symbol").notNull().default("BTCUSD"),
  signalType: text("signal_type").notNull(), // LONG, SHORT
  confidence: real("confidence").notNull(),
  price: real("price").notNull(),
  stopLoss: real("stop_loss"),
  takeProfit: real("take_profit"),
  reasoning: text("reasoning"),
  isActive: boolean("is_active").default(true),
  // ML model component scores
  momentumScore: real("momentum_score").notNull(),
  volumeScore: real("volume_score").notNull(),
  trendScore: real("trend_score").notNull(),
  volatilityScore: real("volatility_score").notNull(),
});

export const trades = pgTable("trades", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  signalId: varchar("signal_id").notNull(),
  symbol: text("symbol").notNull().default("BTCUSD"),
  side: text("side").notNull(), // LONG, SHORT
  entryPrice: real("entry_price").notNull(),
  exitPrice: real("exit_price"),
  quantity: real("quantity").notNull(),
  entryTime: timestamp("entry_time").notNull(),
  exitTime: timestamp("exit_time"),
  pnl: real("pnl"),
  status: text("status").notNull().default("OPEN"), // OPEN, CLOSED, STOPPED
  stopLoss: real("stop_loss"),
  takeProfit: real("take_profit"),
});

export const backtestResults = pgTable("backtest_results", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  startDate: timestamp("start_date").notNull(),
  endDate: timestamp("end_date").notNull(),
  timeframe: text("timeframe").notNull(),
  initialCapital: real("initial_capital").notNull(),
  finalCapital: real("final_capital").notNull(),
  totalReturn: real("total_return").notNull(),
  winRate: real("win_rate").notNull(),
  sharpeRatio: real("sharpe_ratio").notNull(),
  maxDrawdown: real("max_drawdown").notNull(),
  totalTrades: integer("total_trades").notNull(),
  strategy: jsonb("strategy").notNull(), // Strategy parameters used
  createdAt: timestamp("created_at").default(sql`now()`),
});

// Insert schemas
export const insertUserSchema = createInsertSchema(users).pick({
  username: true,
  password: true,
});

export const insertPriceDataSchema = createInsertSchema(priceData).omit({
  id: true,
});

export const insertTechnicalIndicatorsSchema = createInsertSchema(technicalIndicators).omit({
  id: true,
});

export const insertTradingSignalSchema = createInsertSchema(tradingSignals).omit({
  id: true,
  timestamp: true,
  isActive: true,
});

export const insertTradeSchema = createInsertSchema(trades).omit({
  id: true,
  entryTime: true,
  status: true,
});

export const insertBacktestResultSchema = createInsertSchema(backtestResults).omit({
  id: true,
  createdAt: true,
});

// Types
export type InsertUser = z.infer<typeof insertUserSchema>;
export type User = typeof users.$inferSelect;

export type InsertPriceData = z.infer<typeof insertPriceDataSchema>;
export type PriceData = typeof priceData.$inferSelect;

export type InsertTechnicalIndicators = z.infer<typeof insertTechnicalIndicatorsSchema>;
export type TechnicalIndicators = typeof technicalIndicators.$inferSelect;

export type InsertTradingSignal = z.infer<typeof insertTradingSignalSchema>;
export type TradingSignal = typeof tradingSignals.$inferSelect;

export type InsertTrade = z.infer<typeof insertTradeSchema>;
export type Trade = typeof trades.$inferSelect;

export type InsertBacktestResult = z.infer<typeof insertBacktestResultSchema>;
export type BacktestResult = typeof backtestResults.$inferSelect;

// Real-time data types
export interface LivePriceUpdate {
  symbol: string;
  price: number;
  change24h: number;
  changePercent24h: number;
  volume24h: number;
  high24h: number;
  low24h: number;
  timestamp: number;
}

export interface ConfidenceScore {
  longConfidence: number;
  shortConfidence: number;
  momentumScore: number;
  volumeScore: number;
  trendScore: number;
  volatilityScore: number;
  timestamp: number;
}

export interface RiskMetrics {
  sharpeRatio: number;
  riskReward: number;
  volatility: number;
  beta: number;
  maxDrawdown: number;
}
