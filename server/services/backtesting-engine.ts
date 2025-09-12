import { TradingEngine } from './trading-engine';
import { MLPredictor } from './ml-predictor';
import { storage } from '../storage';
import { 
  PriceData, 
  BacktestResult, 
  InsertBacktestResult,
  TradingSignal 
} from '@shared/schema';

export interface BacktestParams {
  symbol: string;
  timeframe: string;
  startDate: Date;
  endDate: Date;
  initialCapital: number;
  riskPerTrade: number; // Percentage of capital to risk per trade
  maxPositions: number; // Maximum concurrent positions
  stopLossPercent: number;
  takeProfitPercent: number;
  strategy: {
    momentum: number;
    volume: number;
    trend: number;
    volatility: number;
  };
}

export interface BacktestTrade {
  entryTime: Date;
  exitTime: Date;
  entryPrice: number;
  exitPrice: number;
  side: 'LONG' | 'SHORT';
  quantity: number;
  pnl: number;
  pnlPercent: number;
  reason: 'TAKE_PROFIT' | 'STOP_LOSS' | 'SIGNAL_EXIT' | 'END_OF_DATA';
}

export interface BacktestStats {
  totalTrades: number;
  winningTrades: number;
  losingTrades: number;
  winRate: number;
  avgWin: number;
  avgLoss: number;
  profitFactor: number;
  sharpeRatio: number;
  maxDrawdown: number;
  totalReturn: number;
  calmarRatio: number;
  averageHoldingPeriod: number; // in hours
}

export class BacktestingEngine {
  private tradingEngine: TradingEngine;
  private mlPredictor: MLPredictor;

  constructor() {
    this.tradingEngine = new TradingEngine();
    this.mlPredictor = new MLPredictor();
  }

  async runBacktest(params: BacktestParams): Promise<BacktestResult> {
    console.log(`Starting backtest for ${params.symbol} from ${params.startDate.toISOString()} to ${params.endDate.toISOString()}`);
    
    // Get historical price data
    const historicalData = await this.getHistoricalData(params.symbol, params.timeframe, params.startDate, params.endDate);
    
    if (historicalData.length < 50) {
      throw new Error('Insufficient historical data for backtesting. Minimum 50 data points required.');
    }

    // Initialize backtest state
    let capital = params.initialCapital;
    let equity = params.initialCapital;
    let peak = params.initialCapital;
    let maxDrawdown = 0;
    const openPositions: Array<{
      entryTime: Date;
      entryPrice: number;
      side: 'LONG' | 'SHORT';
      quantity: number;
      stopLoss: number;
      takeProfit: number;
      signal: TradingSignal;
    }> = [];
    const closedTrades: BacktestTrade[] = [];
    const equityCurve: Array<{ time: Date; equity: number; drawdown: number }> = [];

    // Set trading engine weights
    this.tradingEngine.updateWeights(params.strategy);

    // Process each price point
    for (let i = 50; i < historicalData.length; i++) {
      const currentCandle = historicalData[i];
      const priceHistory = historicalData.slice(Math.max(0, i - 100), i + 1);
      const prices = priceHistory.map(p => p.close);
      const volumes = priceHistory.map(p => p.volume);

      // Check for exit conditions on open positions
      for (let j = openPositions.length - 1; j >= 0; j--) {
        const position = openPositions[j];
        const exitResult = this.checkExitConditions(position, currentCandle);
        
        if (exitResult) {
          // Close position
          const trade: BacktestTrade = {
            entryTime: position.entryTime,
            exitTime: currentCandle.timestamp,
            entryPrice: position.entryPrice,
            exitPrice: exitResult.exitPrice,
            side: position.side,
            quantity: position.quantity,
            pnl: exitResult.pnl,
            pnlPercent: (exitResult.pnl / (position.quantity * position.entryPrice)) * 100,
            reason: exitResult.reason
          };

          closedTrades.push(trade);
          capital += exitResult.pnl;
          equity = capital + this.calculateUnrealizedPnL(openPositions, currentCandle.close);
          
          // Remove closed position
          openPositions.splice(j, 1);
        }
      }

      // Check for new entry signals (only if we have room for more positions)
      if (openPositions.length < params.maxPositions) {
        try {
          const confidence = await this.tradingEngine.calculateConfidenceScore(prices, volumes);
          
          // Generate entry signal based on confidence
          const signal = this.generateEntrySignal(confidence, currentCandle, params);
          
          if (signal && this.shouldEnterTrade(signal, params)) {
            const positionSize = this.calculatePositionSize(capital, currentCandle.close, params.riskPerTrade, params.stopLossPercent);
            
            if (positionSize > 0) {
              const stopLoss = signal.side === 'LONG' 
                ? currentCandle.close * (1 - params.stopLossPercent / 100)
                : currentCandle.close * (1 + params.stopLossPercent / 100);
                
              const takeProfit = signal.side === 'LONG'
                ? currentCandle.close * (1 + params.takeProfitPercent / 100)
                : currentCandle.close * (1 - params.takeProfitPercent / 100);

              openPositions.push({
                entryTime: currentCandle.timestamp,
                entryPrice: currentCandle.close,
                side: signal.side,
                quantity: positionSize,
                stopLoss,
                takeProfit,
                signal: signal.signal
              });
            }
          }
        } catch (error) {
          console.warn(`Error calculating signals for ${currentCandle.timestamp}: ${error}`);
        }
      }

      // Update equity and drawdown
      equity = capital + this.calculateUnrealizedPnL(openPositions, currentCandle.close);
      if (equity > peak) peak = equity;
      const currentDrawdown = (peak - equity) / peak;
      if (currentDrawdown > maxDrawdown) maxDrawdown = currentDrawdown;

      // Record equity curve (sample every 24 hours for efficiency)
      if (i % 24 === 0 || i === historicalData.length - 1) {
        equityCurve.push({
          time: currentCandle.timestamp,
          equity,
          drawdown: currentDrawdown
        });
      }
    }

    // Close any remaining open positions at final price
    const finalPrice = historicalData[historicalData.length - 1];
    for (const position of openPositions) {
      const pnl = this.calculatePositionPnL(position, finalPrice.close);
      closedTrades.push({
        entryTime: position.entryTime,
        exitTime: finalPrice.timestamp,
        entryPrice: position.entryPrice,
        exitPrice: finalPrice.close,
        side: position.side,
        quantity: position.quantity,
        pnl,
        pnlPercent: (pnl / (position.quantity * position.entryPrice)) * 100,
        reason: 'END_OF_DATA'
      });
      capital += pnl;
    }

    // Calculate final statistics
    const stats = this.calculateBacktestStats(closedTrades, params.initialCapital, capital, equityCurve);
    
    // Store backtest result
    const backtestData: InsertBacktestResult = {
      startDate: params.startDate,
      endDate: params.endDate,
      timeframe: params.timeframe,
      initialCapital: params.initialCapital,
      finalCapital: capital,
      totalReturn: stats.totalReturn,
      winRate: stats.winRate,
      sharpeRatio: stats.sharpeRatio,
      maxDrawdown: stats.maxDrawdown,
      totalTrades: stats.totalTrades,
      strategy: params.strategy
    };

    const result = await storage.insertBacktestResult(backtestData);
    
    console.log(`Backtest completed: ${stats.totalTrades} trades, ${stats.winRate.toFixed(2)}% win rate, ${stats.totalReturn.toFixed(2)}% return`);
    
    return {
      ...result,
      trades: closedTrades,
      stats,
      equityCurve
    } as any;
  }

  private async getHistoricalData(symbol: string, timeframe: string, startDate: Date, endDate: Date): Promise<PriceData[]> {
    // In a real implementation, this would fetch actual historical data
    // For now, we'll generate synthetic data or use stored price data
    const existingData = await storage.getPriceData(symbol, timeframe, 1000);
    
    if (existingData.length > 0) {
      return existingData
        .filter(d => d.timestamp >= startDate && d.timestamp <= endDate)
        .sort((a, b) => new Date(a.timestamp).getTime() - new Date(b.timestamp).getTime());
    }

    // Generate synthetic historical data for backtesting
    return this.generateSyntheticHistoricalData(symbol, timeframe, startDate, endDate);
  }

  private generateSyntheticHistoricalData(symbol: string, timeframe: string, startDate: Date, endDate: Date): PriceData[] {
    const data: PriceData[] = [];
    const intervalMs = this.getIntervalMs(timeframe);
    let currentTime = new Date(startDate);
    let currentPrice = 40000; // Starting BTC price
    
    while (currentTime <= endDate) {
      // Generate realistic price movement with volatility
      const volatility = 0.02; // 2% hourly volatility
      const trend = 0.0001; // Slight upward trend
      const randomMove = (Math.random() - 0.5) * volatility;
      const priceChange = (trend + randomMove) * currentPrice;
      
      const open = currentPrice;
      const close = currentPrice + priceChange;
      const high = Math.max(open, close) * (1 + Math.random() * 0.01);
      const low = Math.min(open, close) * (1 - Math.random() * 0.01);
      const volume = 1000000 + Math.random() * 2000000; // Random volume

      data.push({
        id: `synthetic_${currentTime.getTime()}`,
        symbol,
        timestamp: new Date(currentTime),
        timeframe,
        open,
        high,
        low,
        close,
        volume
      });

      currentPrice = close;
      currentTime = new Date(currentTime.getTime() + intervalMs);
    }

    return data;
  }

  private getIntervalMs(timeframe: string): number {
    const intervals: Record<string, number> = {
      '5m': 5 * 60 * 1000,
      '15m': 15 * 60 * 1000,
      '1h': 60 * 60 * 1000,
      '4h': 4 * 60 * 60 * 1000,
      '1d': 24 * 60 * 60 * 1000
    };
    return intervals[timeframe] || intervals['1h'];
  }

  private generateEntrySignal(confidence: any, candle: PriceData, params: BacktestParams): { side: 'LONG' | 'SHORT'; signal: TradingSignal } | null {
    const longThreshold = 65;
    const shortThreshold = 65;

    if (confidence.longConfidence > longThreshold) {
      return {
        side: 'LONG',
        signal: {
          id: `backtest_${Date.now()}`,
          timestamp: candle.timestamp,
          symbol: params.symbol,
          signalType: 'LONG',
          confidence: confidence.longConfidence,
          price: candle.close,
          stopLoss: candle.close * (1 - params.stopLossPercent / 100),
          takeProfit: candle.close * (1 + params.takeProfitPercent / 100),
          reasoning: 'Backtest signal generation',
          isActive: true,
          momentumScore: confidence.momentumScore,
          volumeScore: confidence.volumeScore,
          trendScore: confidence.trendScore,
          volatilityScore: confidence.volatilityScore
        }
      };
    } else if (confidence.shortConfidence > shortThreshold) {
      return {
        side: 'SHORT',
        signal: {
          id: `backtest_${Date.now()}`,
          timestamp: candle.timestamp,
          symbol: params.symbol,
          signalType: 'SHORT',
          confidence: confidence.shortConfidence,
          price: candle.close,
          stopLoss: candle.close * (1 + params.stopLossPercent / 100),
          takeProfit: candle.close * (1 - params.takeProfitPercent / 100),
          reasoning: 'Backtest signal generation',
          isActive: true,
          momentumScore: confidence.momentumScore,
          volumeScore: confidence.volumeScore,
          trendScore: confidence.trendScore,
          volatilityScore: confidence.volatilityScore
        }
      };
    }

    return null;
  }

  private shouldEnterTrade(signal: { side: 'LONG' | 'SHORT'; signal: TradingSignal }, params: BacktestParams): boolean {
    // Add additional filters here if needed
    return signal.signal.confidence >= 65;
  }

  private calculatePositionSize(capital: number, price: number, riskPercent: number, stopLossPercent: number): number {
    const riskAmount = capital * (riskPercent / 100);
    const stopLossDistance = price * (stopLossPercent / 100);
    return riskAmount / stopLossDistance;
  }

  private checkExitConditions(position: any, currentCandle: PriceData): { exitPrice: number; pnl: number; reason: 'TAKE_PROFIT' | 'STOP_LOSS' } | null {
    const currentPrice = currentCandle.close;

    if (position.side === 'LONG') {
      if (currentPrice <= position.stopLoss) {
        const pnl = (position.stopLoss - position.entryPrice) * position.quantity;
        return { exitPrice: position.stopLoss, pnl, reason: 'STOP_LOSS' };
      } else if (currentPrice >= position.takeProfit) {
        const pnl = (position.takeProfit - position.entryPrice) * position.quantity;
        return { exitPrice: position.takeProfit, pnl, reason: 'TAKE_PROFIT' };
      }
    } else { // SHORT
      if (currentPrice >= position.stopLoss) {
        const pnl = (position.entryPrice - position.stopLoss) * position.quantity;
        return { exitPrice: position.stopLoss, pnl, reason: 'STOP_LOSS' };
      } else if (currentPrice <= position.takeProfit) {
        const pnl = (position.entryPrice - position.takeProfit) * position.quantity;
        return { exitPrice: position.takeProfit, pnl, reason: 'TAKE_PROFIT' };
      }
    }

    return null;
  }

  private calculateUnrealizedPnL(positions: any[], currentPrice: number): number {
    return positions.reduce((total, position) => {
      return total + this.calculatePositionPnL(position, currentPrice);
    }, 0);
  }

  private calculatePositionPnL(position: any, currentPrice: number): number {
    if (position.side === 'LONG') {
      return (currentPrice - position.entryPrice) * position.quantity;
    } else {
      return (position.entryPrice - currentPrice) * position.quantity;
    }
  }

  private calculateBacktestStats(trades: BacktestTrade[], initialCapital: number, finalCapital: number, equityCurve: any[]): BacktestStats {
    if (trades.length === 0) {
      return {
        totalTrades: 0,
        winningTrades: 0,
        losingTrades: 0,
        winRate: 0,
        avgWin: 0,
        avgLoss: 0,
        profitFactor: 0,
        sharpeRatio: 0,
        maxDrawdown: 0,
        totalReturn: 0,
        calmarRatio: 0,
        averageHoldingPeriod: 0
      };
    }

    const winningTrades = trades.filter(t => t.pnl > 0);
    const losingTrades = trades.filter(t => t.pnl < 0);
    
    const totalWin = winningTrades.reduce((sum, t) => sum + t.pnl, 0);
    const totalLoss = Math.abs(losingTrades.reduce((sum, t) => sum + t.pnl, 0));
    
    const avgWin = winningTrades.length > 0 ? totalWin / winningTrades.length : 0;
    const avgLoss = losingTrades.length > 0 ? totalLoss / losingTrades.length : 0;
    
    const totalReturn = ((finalCapital - initialCapital) / initialCapital) * 100;
    const maxDrawdown = Math.max(...equityCurve.map(e => e.drawdown)) * 100;
    
    // Calculate Sharpe ratio (simplified)
    const returns = equityCurve.map((_, i) => {
      if (i === 0) return 0;
      return (equityCurve[i].equity - equityCurve[i - 1].equity) / equityCurve[i - 1].equity;
    }).slice(1);
    
    const avgReturn = returns.reduce((sum, r) => sum + r, 0) / returns.length;
    const returnStdDev = Math.sqrt(returns.reduce((sum, r) => sum + Math.pow(r - avgReturn, 2), 0) / returns.length);
    const sharpeRatio = returnStdDev > 0 ? (avgReturn / returnStdDev) * Math.sqrt(365 * 24) : 0;
    
    // Calculate average holding period
    const holdingPeriods = trades.map(t => 
      (new Date(t.exitTime).getTime() - new Date(t.entryTime).getTime()) / (1000 * 60 * 60)
    );
    const averageHoldingPeriod = holdingPeriods.reduce((sum, h) => sum + h, 0) / holdingPeriods.length;

    return {
      totalTrades: trades.length,
      winningTrades: winningTrades.length,
      losingTrades: losingTrades.length,
      winRate: (winningTrades.length / trades.length) * 100,
      avgWin,
      avgLoss,
      profitFactor: totalLoss > 0 ? totalWin / totalLoss : 0,
      sharpeRatio,
      maxDrawdown,
      totalReturn,
      calmarRatio: maxDrawdown > 0 ? totalReturn / maxDrawdown : 0,
      averageHoldingPeriod
    };
  }
}