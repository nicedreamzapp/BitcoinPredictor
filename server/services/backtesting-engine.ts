import { TradingEngine } from './trading-engine';
import { MLPredictor } from './ml-predictor';
import { storage } from '../storage';
import { 
  PriceData, 
  BacktestResult, 
  InsertBacktestResult,
  TradingSignal,
  BacktestParams
} from '@shared/schema';

// BacktestParams interface replaced by the Zod-validated type from shared/schema
export interface BacktestParamsWithDates extends Omit<BacktestParams, 'startDate' | 'endDate'> {
  startDate: Date;
  endDate: Date;
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

  async runBacktest(params: BacktestParamsWithDates): Promise<BacktestResult> {
    console.log(`Starting backtest for ${params.symbol} from ${params.startDate.toISOString()} to ${params.endDate.toISOString()}`);
    
    // Get historical price data
    const historicalData = await this.getHistoricalData(params.symbol, params.timeframe, params.startDate, params.endDate);
    
    const minRequiredDataPoints = 250; // 200 for indicators + 50 for trading
    if (historicalData.length < minRequiredDataPoints) {
      const detailedMessage = `Insufficient historical data for backtesting. ` +
        `Required: ${minRequiredDataPoints} data points (200 for technical analysis + 50 for trading). ` +
        `Available: ${historicalData.length} data points. ` +
        `Period: ${params.startDate.toISOString()} to ${params.endDate.toISOString()}. ` +
        `Timeframe: ${params.timeframe}. ` +
        `Consider using a longer date range or shorter timeframe.`;
      
      console.error(detailedMessage);
      throw new Error(detailedMessage);
    }
    
    console.log(`Backtesting with ${historicalData.length} data points (minimum required: ${minRequiredDataPoints})`);
    console.log(`Technical analysis will start from data point 200, trading from data point 200 to ${historicalData.length - 1}`);
    console.log(`First few historical data timestamps:`, historicalData.slice(0, 5).map(d => d.timestamp.toISOString()));
    console.log(`Last few historical data timestamps:`, historicalData.slice(-5).map(d => d.timestamp.toISOString()));

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

    // Process each price point - start after we have sufficient history for technical analysis
    for (let i = 200; i < historicalData.length; i++) {
      const currentCandle = historicalData[i];
      // Provide sufficient historical data for TradingEngine (needs at least 200 data points)
      // We include the current candle plus 200 previous candles for a total of 201 data points
      const priceHistory = historicalData.slice(i - 200, i + 1);
      const prices = priceHistory.map(p => p.close);
      const volumes = priceHistory.map(p => p.volume);
      
      // Validate we have sufficient data before proceeding
      if (prices.length < 201) {
        console.warn(`Skipping candle at index ${i}: insufficient data (${prices.length} points, need 201+). Slice: ${i - 200} to ${i + 1}`);
        continue;
      }
      
      console.log(`Processing candle ${i}: slice(${i - 200}, ${i + 1}) = ${prices.length} data points`);
      
      // Additional validation - ensure we actually have 201+ points
      if (prices.length < 201) {
        console.error(`Fatal error: after validation, still have insufficient data: ${prices.length} points`);
        continue;
      }

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
        // Follow the same flow as live trading: confidence → ML enhancement → signal generation
        try {
          console.log(`Calculating signals for ${currentCandle.timestamp.toUTCString()}: ${prices.length} prices, ${volumes.length} volumes`);
          const confidence = await this.tradingEngine.calculateConfidenceScore(prices, volumes);
          
          // Enhance with ML analysis like in live trading
          const marketAnalysis = await this.mlPredictor.analyzeMarket(prices, volumes, currentCandle.close);
          const enhancedConfidence = await this.tradingEngine.enhanceWithML(confidence, marketAnalysis);
          
          // Generate trading signal using the enhanced confidence and TradingEngine logic
          const tradingSignal = await this.tradingEngine.generateTradingSignal(enhancedConfidence, currentCandle.close);
          
          if (tradingSignal && this.shouldEnterTradeFromSignal(tradingSignal, params)) {
            const positionSize = this.calculatePositionSize(capital, currentCandle.close, params.riskPerTrade, params.stopLossPercent);
            
            if (positionSize > 0) {
              // Use stop loss and take profit from the actual trading signal
              openPositions.push({
                entryTime: currentCandle.timestamp,
                entryPrice: currentCandle.close,
                side: tradingSignal.signalType as 'LONG' | 'SHORT',
                quantity: positionSize,
                stopLoss: tradingSignal.stopLoss,
                takeProfit: tradingSignal.takeProfit,
                signal: tradingSignal
              });
            }
          }
        } catch (error) {
          console.error(`Error calculating signals for ${currentCandle.timestamp.toUTCString()}: ${error instanceof Error ? error.message : 'Unknown error'}`);
          // Continue with next iteration instead of failing the entire backtest
          continue;
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
      // Sort existing data by timestamp
      const sortedData = existingData.sort((a, b) => new Date(a.timestamp).getTime() - new Date(b.timestamp).getTime());
      
      // Calculate required periods: 300 for pre-analysis + period count for date range
      const intervalMs = this.getIntervalMs(timeframe);
      const periodCount = Math.ceil((endDate.getTime() - startDate.getTime()) / intervalMs);
      const requiredDataPoints = 300 + periodCount; // 300 for technical analysis + actual trading period
      
      // If we have enough existing data that covers the needed timeframe
      if (sortedData.length >= requiredDataPoints) {
        console.log(`Using existing price data: ${sortedData.length} points (need ${requiredDataPoints})`);
        
        // Find the start index for our extended start date (300 periods before actual start)
        const extendedStartDate = new Date(startDate.getTime() - (300 * intervalMs));
        
        // Filter data to include pre-analysis data
        const filteredData = sortedData.filter(d => {
          const timestamp = new Date(d.timestamp).getTime();
          return timestamp >= extendedStartDate.getTime() && timestamp <= endDate.getTime();
        });
        
        if (filteredData.length >= 250) { // Minimum required for backtesting
          console.log(`Filtered existing data: ${filteredData.length} points for backtest`);
          return filteredData;
        }
      }
      
      console.log(`Existing data insufficient (${sortedData.length} points, need ${requiredDataPoints}), generating synthetic data`);
    }

    // Generate synthetic historical data for backtesting (includes pre-data for technical analysis)
    console.log(`Generating synthetic data for backtest from ${startDate.toISOString()} to ${endDate.toISOString()}`);
    return this.generateSyntheticHistoricalData(symbol, timeframe, startDate, endDate);
  }

  private generateSyntheticHistoricalData(symbol: string, timeframe: string, startDate: Date, endDate: Date): PriceData[] {
    const data: PriceData[] = [];
    const intervalMs = this.getIntervalMs(timeframe);
    
    // Ensure we have enough pre-data for technical analysis (add 300 periods before start date)
    const extendedStartDate = new Date(startDate.getTime() - (300 * intervalMs));
    let currentTime = new Date(extendedStartDate);
    let currentPrice = 40000; // Starting BTC price
    
    while (currentTime <= endDate) {
      // Generate realistic price movement with volatility
      const volatility = 0.015; // 1.5% volatility per period
      const trend = 0.00005; // Slight upward trend
      const randomMove = (Math.random() - 0.5) * volatility;
      const priceChange = (trend + randomMove) * currentPrice;
      
      const open = currentPrice;
      const close = currentPrice + priceChange;
      const high = Math.max(open, close) * (1 + Math.random() * 0.008);
      const low = Math.min(open, close) * (1 - Math.random() * 0.008);
      const volume = 800000 + Math.random() * 1600000; // Random volume between 800k-2.4M

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

    console.log(`Generated ${data.length} synthetic data points for backtesting (${300} extra periods for technical analysis)`);
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

  // Removed generateEntrySignal method since we now use TradingEngine.generateTradingSignal directly

  private shouldEnterTradeFromSignal(signal: TradingSignal, params: BacktestParamsWithDates): boolean {
    // Signal has already been filtered by TradingEngine's threshold logic
    // Add any additional backtesting-specific filters here if needed
    return signal.isActive && signal.confidence >= 0.65; // confidence is stored as decimal in TradingSignal
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