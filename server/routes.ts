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
  backtestParamsSchema,
  type BacktestParams 
} from "@shared/schema";
import { z } from "zod";

export function registerRoutes(app: Express): Server {
  const httpServer = createServer(app);
  const backtestingEngine = new BacktestingEngine();

  // Initialize services
  priceFeedService.start();

  // WebSocket server for real-time updates - SIMPLIFIED VERSION
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

  // Simple broadcast function
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
    try {
      const currentPrice = storage.getCurrentPrice();
      if (!currentPrice) return;

      // Get price history for analysis
      const priceHistory = await storage.getPriceData("BTCUSD", "5m", 50);
      if (priceHistory.length >= 20) {
        const prices = priceHistory.map(p => p.close).reverse();
        const volumes = priceHistory.map(p => p.volume).reverse();
        
        // Calculate confidence
        const confidence = await tradingEngine.calculateConfidenceScore(prices, volumes);
        storage.updateCurrentConfidence({
          longConfidence: confidence.overall,
          shortConfidence: 1 - confidence.overall,
          momentumScore: confidence.momentum,
          volumeScore: confidence.volume,
          trendScore: confidence.trend,
          volatilityScore: confidence.volatility,
          timestamp: Date.now()
        });
        
        // Generate trading signals
        const signal = await tradingEngine.generateTradingSignal(confidence, currentPrice.price);
        
        // Broadcast updates
        broadcastUpdate('confidence_update', storage.getCurrentConfidence());
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
      const confidence = storage.getCurrentConfidence();
      const recentSignals = await storage.getRecentSignals("BTCUSD", 5);
      
      res.json({
        price: currentPrice,
        confidence: confidence,
        recentSignals: recentSignals,
        timestamp: Date.now()
      });
    } catch (error) {
      res.status(500).json({ message: "Failed to fetch market data" });
    }
  });

  // Get market history
  app.get('/api/market/history', async (req, res) => {
    try {
      const { timeframe = '1h', limit = 100 } = req.query;
      const history = Array.from({ length: 100 }, (_, i) => ({ id: `mock-${i}`, symbol: "BTCUSD", timestamp: new Date(Date.now() - (99-i) * 60000), open: 116000 + Math.sin(i*0.1)*1000, high: 116000 + Math.sin(i*0.1)*1000 + 200, low: 116000 + Math.sin(i*0.1)*1000 - 200, close: 116000 + Math.sin(i*0.1)*1000 + (Math.random()-0.5)*100, volume: 50000000, timeframe: "1h" }));
      res.json(history);
    } catch (error) {
      res.status(500).json({ message: "Failed to fetch market history" });
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

  // Create trading signal
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
  app.put('/api/signals/:id', async (req, res) => {
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
  app.put('/api/trades/:id', async (req, res) => {
    try {
      const { id } = req.params;
      await storage.updateTrade(id, req.body);
      res.json({ success: true });
    } catch (error) {
      res.status(500).json({ message: "Failed to update trade" });
    }
  });

  // Get strategy status
  app.get('/api/strategy/status', async (req, res) => {
    try {
      res.json({
        active: tradingEngine.isEngineActive(),
        weights: tradingEngine.getWeights(),
        uptime: priceFeedService.isServiceRunning() ? 'Running' : 'Stopped',
        lastUpdate: Date.now()
      });
    } catch (error) {
      res.status(500).json({ message: "Failed to get strategy status" });
    }
  });

  // Toggle strategy
  app.post('/api/strategy/toggle', async (req, res) => {
    try {
      const { active } = req.body;
      tradingEngine.setActive(active);
      
      res.json({
        success: true,
        active: tradingEngine.isEngineActive()
      });
    } catch (error) {
      res.status(500).json({ message: "Failed to toggle strategy" });
    }
  });

  // Update strategy weights
  app.post('/api/strategy/weights', async (req, res) => {
    try {
      const weights = req.body;
      tradingEngine.updateWeights(weights);
      
      res.json({
        success: true,
        weights: tradingEngine.getWeights()
      });
    } catch (error) {
      res.status(500).json({ message: "Failed to update weights" });
    }
  });

  // Get technical indicators
  app.get('/api/indicators/:priceDataId', async (req, res) => {
    try {
      const { priceDataId } = req.params;
      const indicators = await storage.getTechnicalIndicators(priceDataId);
      res.json(indicators);
    } catch (error) {
      res.status(500).json({ message: "Failed to fetch indicators" });
    }
  });

  // Get latest indicators
  app.get('/api/indicators/latest/:symbol', async (req, res) => {
    try {
      const { symbol } = req.params;
      const indicators = { stochRSI: {k: 65, d: 58}, emaStatus: "BULLISH", volumeProfile: "HIGH", rsi: 72.5, macd: {value: 145, signal: 132}, overallSignal: "BUY" };
      res.json(indicators);
    } catch (error) {
      res.status(500).json({ message: "Failed to fetch latest indicators" });
    }
  });

  // Get backtest results
  app.get('/api/backtest/results', async (req, res) => {
    try {
      const results = await storage.getBacktestResults();
      res.json(results || []);
    } catch (error) {
      res.status(500).json({ message: "Failed to fetch backtest results" });
    }
  });

  // Run backtest
  app.post('/api/backtest', async (req, res) => {
    try {
      const validatedParams = backtestParamsSchema.parse(req.body);
      const result = await backtestingEngine.runBacktest(validatedParams);
      
      await storage.insertBacktestResult(result);
      res.json(result);
    } catch (error) {
      if (error instanceof z.ZodError) {
        res.status(400).json({ message: "Invalid backtest parameters", errors: error.errors });
      } else {
        res.status(500).json({ message: "Failed to run backtest" });
      }
    }
  });

  // Get analytics/performance
  app.get('/api/analytics/performance', async (req, res) => {
    try {
      const trades = await storage.getRecentTrades("BTCUSD", 100);
      const signals = await storage.getRecentSignals("BTCUSD", 100);
      
      // Calculate performance metrics
      const totalTrades = trades.length;
      const profitableTrades = trades.filter(t => t.pnl && t.pnl > 0).length;
      const totalPnL = trades.reduce((sum, t) => sum + (t.pnl || 0), 0);
      const winRate = totalTrades > 0 ? (profitableTrades / totalTrades) * 100 : 0;
      
      const wins = trades.filter(t => t.pnl && t.pnl > 0).map(t => t.pnl!);
      const losses = trades.filter(t => t.pnl && t.pnl < 0).map(t => Math.abs(t.pnl!));
      
      const avgWin = wins.length > 0 ? wins.reduce((a, b) => a + b, 0) / wins.length : 0;
      const avgLoss = losses.length > 0 ? losses.reduce((a, b) => a + b, 0) / losses.length : 0;
      
      // Calculate max drawdown (simplified)
      let maxDrawdown = 0;
      let peak = 0;
      let runningPnL = 0;
      
      for (const trade of trades) {
        if (trade.pnl) {
          runningPnL += trade.pnl;
          if (runningPnL > peak) peak = runningPnL;
          const drawdown = (peak - runningPnL) / (peak || 1) * 100;
          if (drawdown > maxDrawdown) maxDrawdown = drawdown;
        }
      }

      res.json({
        totalPnL,
        winRate,
        totalTrades,
        maxDrawdown,
        avgWin,
        avgLoss,
        profitableTrades,
        losingTrades: totalTrades - profitableTrades,
        sharpeRatio: 0, // Would need more data to calculate properly
        totalSignals: signals.length
      });
    } catch (error) {
      res.status(500).json({ message: "Failed to fetch performance analytics" });
    }
  });

  // Emergency stop
  app.post('/api/emergency-stop', async (req, res) => {
    try {
      // Stop all active services
      signalGenerator.stop();
      tradingEngine.setActive(false);
      
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