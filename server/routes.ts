import type { Express } from "express";
import { createServer, type Server } from "http";
import { WebSocketServer, WebSocket } from "ws";
import { storage } from "./storage";
import { tradingEngine } from "./services/trading-engine";
import { priceFeedService } from "./services/price-feed";
import { mlPredictor } from "./services/ml-predictor";
import { BacktestingEngine } from "./services/backtesting-engine";
import { 
  insertTradingSignalSchema,
  insertTradeSchema,
  insertBacktestResultSchema,
  type LivePriceUpdate,
  type ConfidenceScore
} from "@shared/schema";
import { z } from "zod";

export async function registerRoutes(app: Express): Promise<Server> {
  const httpServer = createServer(app);
  const backtestingEngine = new BacktestingEngine();

  // Initialize services
  priceFeedService.start();

  // WebSocket server for real-time updates
  const wss = new WebSocketServer({ server: httpServer, path: '/ws' });

  wss.on('connection', (ws: WebSocket) => {
    console.log('WebSocket client connected');

    // Send initial data
    const currentPrice = storage.getCurrentPrice();
    const currentConfidence = storage.getCurrentConfidence();
    
    if (currentPrice) {
      ws.send(JSON.stringify({ type: 'price_update', data: currentPrice }));
    }
    
    if (currentConfidence) {
      ws.send(JSON.stringify({ type: 'confidence_update', data: currentConfidence }));
    }

    ws.on('close', () => {
      console.log('WebSocket client disconnected');
    });

    ws.on('error', (error) => {
      console.error('WebSocket error:', error);
    });
  });

  // Broadcast price updates to all connected clients
  const broadcastUpdate = (type: string, data: any) => {
    const message = JSON.stringify({ type, data });
    wss.clients.forEach(client => {
      if (client.readyState === WebSocket.OPEN) {
        client.send(message);
      }
    });
  };

  // Real-time data processing
  setInterval(async () => {
    const currentPrice = storage.getCurrentPrice();
    if (!currentPrice) return;

    try {
      // Get historical data for analysis
      const priceHistory = await storage.getPriceData("BTCUSD", "5m", 200);
      const prices = priceHistory.map(p => p.close).reverse();
      const volumes = priceHistory.map(p => p.volume).reverse();

      if (prices.length >= 200) {
        // Calculate confidence scores
        const confidence = await tradingEngine.calculateConfidenceScore(prices, volumes);
        
        // Enhance with ML
        const marketAnalysis = await mlPredictor.analyzeMarket(prices, volumes, currentPrice.price);
        const enhancedConfidence = await tradingEngine.enhanceWithML(confidence, marketAnalysis);
        
        // Generate trading signals
        const signal = await tradingEngine.generateTradingSignal(enhancedConfidence, currentPrice.price);
        
        // Broadcast updates
        broadcastUpdate('confidence_update', enhancedConfidence);
        if (signal) {
          broadcastUpdate('new_signal', signal);
        }
      }
    } catch (error) {
      console.error('Real-time analysis error:', error);
    }
  }, 5000); // Every 5 seconds

  // Update risk metrics periodically
  setInterval(async () => {
    try {
      const riskMetrics = await mlPredictor.calculateRiskMetrics();
      broadcastUpdate('risk_metrics', riskMetrics);
    } catch (error) {
      console.error('Risk metrics update error:', error);
    }
  }, 30000); // Every 30 seconds

  // API Routes

  // Get current market data
  app.get('/api/market/current', async (req, res) => {
    try {
      const currentPrice = storage.getCurrentPrice();
      const currentConfidence = storage.getCurrentConfidence();
      const riskMetrics = storage.getRiskMetrics();
      const latestIndicators = await storage.getLatestIndicators("BTCUSD");

      res.json({
        price: currentPrice,
        confidence: currentConfidence,
        riskMetrics,
        indicators: latestIndicators
      });
    } catch (error) {
      res.status(500).json({ message: "Failed to fetch market data" });
    }
  });

  // Get historical price data
  app.get('/api/market/history', async (req, res) => {
    try {
      const { timeframe = '5m', limit = '100' } = req.query;
      const priceData = await storage.getPriceData("BTCUSD", timeframe as string, parseInt(limit as string));
      res.json(priceData);
    } catch (error) {
      res.status(500).json({ message: "Failed to fetch price history" });
    }
  });

  // Get trading signals
  app.get('/api/signals', async (req, res) => {
    try {
      const { active = 'false', limit = '20' } = req.query;
      const signals = active === 'true' 
        ? await storage.getActiveSignals("BTCUSD")
        : await storage.getRecentSignals("BTCUSD", parseInt(limit as string));
      res.json(signals);
    } catch (error) {
      res.status(500).json({ message: "Failed to fetch signals" });
    }
  });

  // Create manual trading signal
  app.post('/api/signals', async (req, res) => {
    try {
      const validatedData = insertTradingSignalSchema.parse(req.body);
      const signal = await storage.insertTradingSignal(validatedData);
      
      // Broadcast new signal
      broadcastUpdate('new_signal', signal);
      
      res.json(signal);
    } catch (error) {
      if (error instanceof z.ZodError) {
        res.status(400).json({ message: "Invalid signal data", errors: error.errors });
      } else {
        res.status(500).json({ message: "Failed to create signal" });
      }
    }
  });

  // Update signal status
  app.patch('/api/signals/:id', async (req, res) => {
    try {
      const { id } = req.params;
      const { isActive } = req.body;
      
      await storage.updateSignalStatus(id, isActive);
      res.json({ success: true });
    } catch (error) {
      res.status(500).json({ message: "Failed to update signal" });
    }
  });

  // Get trades
  app.get('/api/trades', async (req, res) => {
    try {
      const { active = 'false', limit = '50' } = req.query;
      const trades = active === 'true'
        ? await storage.getActiveTrades("BTCUSD")
        : await storage.getRecentTrades("BTCUSD", parseInt(limit as string));
      res.json(trades);
    } catch (error) {
      res.status(500).json({ message: "Failed to fetch trades" });
    }
  });

  // Create trade
  app.post('/api/trades', async (req, res) => {
    try {
      const validatedData = insertTradeSchema.parse(req.body);
      const trade = await storage.insertTrade(validatedData);
      
      broadcastUpdate('new_trade', trade);
      res.json(trade);
    } catch (error) {
      if (error instanceof z.ZodError) {
        res.status(400).json({ message: "Invalid trade data", errors: error.errors });
      } else {
        res.status(500).json({ message: "Failed to create trade" });
      }
    }
  });

  // Update trade
  app.patch('/api/trades/:id', async (req, res) => {
    try {
      const { id } = req.params;
      await storage.updateTrade(id, req.body);
      res.json({ success: true });
    } catch (error) {
      res.status(500).json({ message: "Failed to update trade" });
    }
  });

  // Strategy controls
  app.post('/api/strategy/toggle', async (req, res) => {
    try {
      const { active } = req.body;
      tradingEngine.setActive(active);
      res.json({ active: tradingEngine.isEngineActive() });
    } catch (error) {
      res.status(500).json({ message: "Failed to toggle strategy" });
    }
  });

  app.get('/api/strategy/status', async (req, res) => {
    try {
      res.json({
        active: tradingEngine.isEngineActive(),
        weights: tradingEngine.getWeights()
      });
    } catch (error) {
      res.status(500).json({ message: "Failed to get strategy status" });
    }
  });

  app.post('/api/strategy/weights', async (req, res) => {
    try {
      const weights = req.body;
      tradingEngine.updateWeights(weights);
      res.json({ weights: tradingEngine.getWeights() });
    } catch (error) {
      res.status(500).json({ message: "Failed to update weights" });
    }
  });

  // Backtesting
  // Run comprehensive backtest
  app.post('/api/backtest/run', async (req, res) => {
    try {
      const {
        symbol = 'BTCUSD',
        timeframe = '1h',
        startDate,
        endDate,
        initialCapital = 10000,
        riskPerTrade = 2,
        maxPositions = 3,
        stopLossPercent = 3,
        takeProfitPercent = 6,
        strategy = {
          momentum: 0.35,
          volume: 0.30,
          trend: 0.18,
          volatility: 0.17
        }
      } = req.body;

      if (!startDate || !endDate) {
        return res.status(400).json({ 
          message: "Start date and end date are required" 
        });
      }

      const backtestParams = {
        symbol,
        timeframe,
        startDate: new Date(startDate),
        endDate: new Date(endDate),
        initialCapital,
        riskPerTrade,
        maxPositions,
        stopLossPercent,
        takeProfitPercent,
        strategy
      };

      console.log('Running backtest with params:', backtestParams);
      const result = await backtestingEngine.runBacktest(backtestParams);
      res.json(result);
    } catch (error) {
      console.error('Backtest error:', error);
      res.status(500).json({ 
        message: "Failed to run backtest", 
        error: error instanceof Error ? error.message : 'Unknown error'
      });
    }
  });

  // Quick backtest with default parameters
  app.post('/api/backtest/quick', async (req, res) => {
    try {
      const endDate = new Date();
      const startDate = new Date(endDate.getTime() - 30 * 24 * 60 * 60 * 1000); // 30 days ago
      
      const backtestParams = {
        symbol: 'BTCUSD',
        timeframe: '1h',
        startDate,
        endDate,
        initialCapital: 10000,
        riskPerTrade: 2,
        maxPositions: 3,
        stopLossPercent: 3,
        takeProfitPercent: 6,
        strategy: {
          momentum: 0.35,
          volume: 0.30,
          trend: 0.18,
          volatility: 0.17
        }
      };

      console.log('Running quick backtest...');
      const result = await backtestingEngine.runBacktest(backtestParams);
      res.json(result);
    } catch (error) {
      console.error('Quick backtest error:', error);
      res.status(500).json({ 
        message: "Failed to run quick backtest", 
        error: error instanceof Error ? error.message : 'Unknown error'
      });
    }
  });

  app.get('/api/backtest/results', async (req, res) => {
    try {
      const { limit = '10' } = req.query;
      const results = await storage.getBacktestResults(parseInt(limit as string));
      res.json(results);
    } catch (error) {
      res.status(500).json({ message: "Failed to fetch backtest results" });
    }
  });

  // Performance analytics
  app.get('/api/analytics/performance', async (req, res) => {
    try {
      const trades = await storage.getRecentTrades("BTCUSD", 100);
      const closedTrades = trades.filter(t => t.status === "CLOSED" && t.pnl !== null);
      
      const winningTrades = closedTrades.filter(t => t.pnl! > 0);
      const winRate = closedTrades.length > 0 ? (winningTrades.length / closedTrades.length) * 100 : 0;
      const totalPnL = closedTrades.reduce((sum, t) => sum + (t.pnl || 0), 0);
      
      const maxDrawdown = closedTrades.length > 0 
        ? Math.min(...closedTrades.map(t => t.pnl || 0)) 
        : 0;

      res.json({
        totalPnL,
        winRate,
        totalTrades: closedTrades.length,
        maxDrawdown,
        avgWin: winningTrades.length > 0 
          ? winningTrades.reduce((sum, t) => sum + t.pnl!, 0) / winningTrades.length 
          : 0,
        avgLoss: closedTrades.length > winningTrades.length
          ? closedTrades.filter(t => t.pnl! <= 0).reduce((sum, t) => sum + t.pnl!, 0) / (closedTrades.length - winningTrades.length)
          : 0
      });
    } catch (error) {
      res.status(500).json({ message: "Failed to fetch performance analytics" });
    }
  });

  // Emergency stop
  app.post('/api/emergency-stop', async (req, res) => {
    try {
      tradingEngine.setActive(false);
      
      // Close all active trades
      const activeTrades = await storage.getActiveTrades("BTCUSD");
      const currentPrice = storage.getCurrentPrice();
      
      if (currentPrice) {
        for (const trade of activeTrades) {
          await storage.updateTrade(trade.id, {
            status: "CLOSED",
            exitPrice: currentPrice.price,
            exitTime: new Date(),
            pnl: (currentPrice.price - trade.entryPrice) * trade.quantity * (trade.side === "LONG" ? 1 : -1)
          });
        }
      }

      // Deactivate all signals
      const activeSignals = await storage.getActiveSignals("BTCUSD");
      for (const signal of activeSignals) {
        await storage.updateSignalStatus(signal.id, false);
      }

      broadcastUpdate('emergency_stop', { timestamp: Date.now() });
      
      res.json({ success: true, message: "Emergency stop executed" });
    } catch (error) {
      res.status(500).json({ message: "Failed to execute emergency stop" });
    }
  });

  return httpServer;
}
