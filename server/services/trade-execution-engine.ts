import { storage } from "../storage";
import { 
  type Trade, 
  type TradingSignal, 
  type InsertTrade,
  type ConfidenceScore 
} from "@shared/schema";

export interface TradeExecutionResult {
  success: boolean;
  trade?: Trade;
  error?: string;
}

export interface PositionManager {
  openPositions: Map<string, Trade>;
  maxPositions: number;
  riskPerTrade: number; // Percentage of capital to risk per trade
  totalCapital: number;
}

export interface PnLUpdate {
  tradeId: string;
  currentPrice: number;
  unrealizedPnL: number;
  unrealizedPnLPercent: number;
  shouldClose: boolean;
  reason?: 'TAKE_PROFIT' | 'STOP_LOSS' | 'TRAILING_STOP';
}

export class TradeExecutionEngine {
  private positionManager: PositionManager;
  private marketPrice: number = 0;
  private isActive: boolean = true;

  constructor() {
    this.positionManager = {
      openPositions: new Map(),
      maxPositions: 3,
      riskPerTrade: 2, // 2% risk per trade
      totalCapital: 10000 // Default starting capital
    };
  }

  /**
   * Execute a trade based on a trading signal
   */
  async executeSignal(signal: TradingSignal, currentPrice: number): Promise<TradeExecutionResult> {
    if (!this.isActive) {
      return { success: false, error: "Trading engine is not active" };
    }

    // Check position limits
    if (this.positionManager.openPositions.size >= this.positionManager.maxPositions) {
      return { success: false, error: "Maximum position limit reached" };
    }

    // Calculate position size based on risk management
    const positionSize = this.calculatePositionSize(currentPrice, signal.stopLoss || 0);
    
    if (positionSize <= 0) {
      return { success: false, error: "Position size too small or invalid risk parameters" };
    }

    try {
      // Create trade from signal
      const tradeData: InsertTrade = {
        signalId: signal.id,
        symbol: signal.symbol,
        side: signal.signalType,
        entryPrice: currentPrice,
        quantity: positionSize,
        entryTime: new Date(),
        status: "OPEN",
        stopLoss: signal.stopLoss,
        takeProfit: signal.takeProfit,
        pnl: 0
      };

      const trade = await storage.insertTrade(tradeData);
      
      // Add to position manager
      this.positionManager.openPositions.set(trade.id, trade);
      
      // Log trade execution
      console.log(`Trade executed: ${signal.signalType} ${signal.symbol} at ${currentPrice}, Size: ${positionSize}, SL: ${signal.stopLoss}, TP: ${signal.takeProfit}`);
      
      return { success: true, trade };
    } catch (error) {
      console.error("Failed to execute trade:", error);
      return { success: false, error: "Failed to create trade record" };
    }
  }

  /**
   * Update all open positions with current market price
   */
  async updatePositions(currentPrice: number): Promise<PnLUpdate[]> {
    this.marketPrice = currentPrice;
    const updates: PnLUpdate[] = [];

    for (const [tradeId, trade] of this.positionManager.openPositions) {
      const pnlUpdate = this.calculatePnL(trade, currentPrice);
      updates.push(pnlUpdate);

      // Check if position should be closed
      if (pnlUpdate.shouldClose) {
        await this.closePosition(tradeId, currentPrice, pnlUpdate.reason);
      } else {
        // Update unrealized PnL in database
        await storage.updateTrade(tradeId, { 
          pnl: pnlUpdate.unrealizedPnL 
        });
      }
    }

    return updates;
  }

  /**
   * Close a position manually or due to stop/take profit
   */
  async closePosition(tradeId: string, exitPrice: number, reason?: string): Promise<TradeExecutionResult> {
    const trade = this.positionManager.openPositions.get(tradeId);
    if (!trade) {
      return { success: false, error: "Trade not found" };
    }

    try {
      // Calculate final PnL
      const finalPnL = this.calculateFinalPnL(trade, exitPrice);
      
      // Update trade in database
      await storage.updateTrade(tradeId, {
        exitPrice,
        exitTime: new Date(),
        status: "CLOSED",
        pnl: finalPnL
      });

      // Remove from active positions
      this.positionManager.openPositions.delete(tradeId);

      // Get updated trade
      const closedTrade = await storage.getTrade(tradeId);
      
      console.log(`Position closed: ${trade.side} ${trade.symbol}, Entry: ${trade.entryPrice}, Exit: ${exitPrice}, PnL: ${finalPnL.toFixed(2)}, Reason: ${reason || 'Manual'}`);
      
      return { success: true, trade: closedTrade };
    } catch (error) {
      console.error("Failed to close position:", error);
      return { success: false, error: "Failed to close position" };
    }
  }

  /**
   * Calculate position size based on risk management
   */
  private calculatePositionSize(entryPrice: number, stopLoss: number): number {
    if (stopLoss === 0) return 0;
    
    const riskAmount = this.positionManager.totalCapital * (this.positionManager.riskPerTrade / 100);
    const riskPerUnit = Math.abs(entryPrice - stopLoss);
    
    if (riskPerUnit === 0) return 0;
    
    const positionSize = riskAmount / riskPerUnit;
    
    // Ensure minimum position size (e.g., $10 worth)
    const minPositionValue = 10;
    const minPositionSize = minPositionValue / entryPrice;
    
    return Math.max(positionSize, minPositionSize);
  }

  /**
   * Calculate real-time PnL for a position
   */
  private calculatePnL(trade: Trade, currentPrice: number): PnLUpdate {
    const isLong = trade.side === "LONG";
    const priceDiff = isLong ? (currentPrice - trade.entryPrice) : (trade.entryPrice - currentPrice);
    const unrealizedPnL = priceDiff * trade.quantity;
    const unrealizedPnLPercent = (priceDiff / trade.entryPrice) * 100;

    // Check stop loss and take profit conditions
    let shouldClose = false;
    let reason: 'TAKE_PROFIT' | 'STOP_LOSS' | 'TRAILING_STOP' | undefined;

    if (trade.stopLoss && 
        ((isLong && currentPrice <= trade.stopLoss) || 
         (!isLong && currentPrice >= trade.stopLoss))) {
      shouldClose = true;
      reason = 'STOP_LOSS';
    } else if (trade.takeProfit && 
               ((isLong && currentPrice >= trade.takeProfit) || 
                (!isLong && currentPrice <= trade.takeProfit))) {
      shouldClose = true;
      reason = 'TAKE_PROFIT';
    }

    return {
      tradeId: trade.id,
      currentPrice,
      unrealizedPnL,
      unrealizedPnLPercent,
      shouldClose,
      reason
    };
  }

  /**
   * Calculate final PnL when closing a position
   */
  private calculateFinalPnL(trade: Trade, exitPrice: number): number {
    const isLong = trade.side === "LONG";
    const priceDiff = isLong ? (exitPrice - trade.entryPrice) : (trade.entryPrice - exitPrice);
    return priceDiff * trade.quantity;
  }

  /**
   * Get current portfolio metrics
   */
  async getPortfolioMetrics(): Promise<{
    totalPnL: number;
    unrealizedPnL: number;
    realizedPnL: number;
    openPositions: number;
    totalTrades: number;
    winRate: number;
    currentCapital: number;
  }> {
    // Get all trades for metrics calculation
    const allTrades = await storage.getRecentTrades("BTCUSD", 1000);
    const closedTrades = allTrades.filter(t => t.status === "CLOSED");
    
    // Calculate realized PnL from closed trades
    const realizedPnL = closedTrades.reduce((sum, trade) => sum + (trade.pnl || 0), 0);
    
    // Calculate unrealized PnL from open positions
    let unrealizedPnL = 0;
    for (const trade of this.positionManager.openPositions.values()) {
      const pnlUpdate = this.calculatePnL(trade, this.marketPrice);
      unrealizedPnL += pnlUpdate.unrealizedPnL;
    }

    // Calculate win rate
    const winningTrades = closedTrades.filter(t => (t.pnl || 0) > 0).length;
    const winRate = closedTrades.length > 0 ? (winningTrades / closedTrades.length) * 100 : 0;

    return {
      totalPnL: realizedPnL + unrealizedPnL,
      unrealizedPnL,
      realizedPnL,
      openPositions: this.positionManager.openPositions.size,
      totalTrades: allTrades.length,
      winRate,
      currentCapital: this.positionManager.totalCapital + realizedPnL
    };
  }

  /**
   * Update risk management settings
   */
  updateRiskSettings(settings: {
    maxPositions?: number;
    riskPerTrade?: number;
    totalCapital?: number;
  }): void {
    if (settings.maxPositions !== undefined) {
      this.positionManager.maxPositions = settings.maxPositions;
    }
    if (settings.riskPerTrade !== undefined) {
      this.positionManager.riskPerTrade = settings.riskPerTrade;
    }
    if (settings.totalCapital !== undefined) {
      this.positionManager.totalCapital = settings.totalCapital;
    }
  }

  /**
   * Force close all open positions (emergency stop)
   */
  async closeAllPositions(currentPrice: number): Promise<TradeExecutionResult[]> {
    const results: TradeExecutionResult[] = [];
    const positionIds = Array.from(this.positionManager.openPositions.keys());
    
    for (const tradeId of positionIds) {
      const result = await this.closePosition(tradeId, currentPrice, "Emergency close");
      results.push(result);
    }
    
    return results;
  }

  /**
   * Load existing open positions from database
   */
  async loadOpenPositions(): Promise<void> {
    try {
      const activeTrades = await storage.getActiveTrades("BTCUSD");
      this.positionManager.openPositions.clear();
      
      for (const trade of activeTrades) {
        this.positionManager.openPositions.set(trade.id, trade);
      }
      
      console.log(`Loaded ${activeTrades.length} open positions`);
    } catch (error) {
      console.error("Failed to load open positions:", error);
    }
  }

  /**
   * Set engine active/inactive state
   */
  setActive(active: boolean): void {
    this.isActive = active;
  }

  /**
   * Get current position summary
   */
  getPositionSummary(): {
    totalPositions: number;
    maxPositions: number;
    availableSlots: number;
    riskPerTrade: number;
    totalCapital: number;
  } {
    return {
      totalPositions: this.positionManager.openPositions.size,
      maxPositions: this.positionManager.maxPositions,
      availableSlots: this.positionManager.maxPositions - this.positionManager.openPositions.size,
      riskPerTrade: this.positionManager.riskPerTrade,
      totalCapital: this.positionManager.totalCapital
    };
  }
}

// Create singleton instance
export const tradeExecutionEngine = new TradeExecutionEngine();