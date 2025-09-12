import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Checkbox } from "@/components/ui/checkbox";
import { Expand, Activity } from "lucide-react";
import { useState, useEffect, useRef } from "react";
import { useQuery } from "@tanstack/react-query";

export default function TradingChart() {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const [timeframe, setTimeframe] = useState("1h");
  const [showEMA, setShowEMA] = useState(true);
  const [showVolume, setShowVolume] = useState(true);
  const [showStochRSI, setShowStochRSI] = useState(false);
  const [showSignals, setShowSignals] = useState(true);

  const { data: priceHistory = [], isLoading } = useQuery({
    queryKey: ['/api/market/history', timeframe],
    refetchInterval: 5000,
  });

  useEffect(() => {
    if (!canvasRef.current || !priceHistory) return;

    const canvas = canvasRef.current;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    // Set canvas size
    const rect = canvas.getBoundingClientRect();
    canvas.width = rect.width * devicePixelRatio;
    canvas.height = rect.height * devicePixelRatio;
    ctx.scale(devicePixelRatio, devicePixelRatio);

    // Clear canvas
    ctx.fillStyle = '#0f172a';
    ctx.fillRect(0, 0, rect.width, rect.height);

    if (!priceHistory || priceHistory.length === 0) {
      // Draw "No data" message
      ctx.fillStyle = '#64748b';
      ctx.font = '14px Inter';
      ctx.textAlign = 'center';
      ctx.fillText('Loading price data...', rect.width / 2, rect.height / 2);
      return;
    }

    // Draw price chart
    drawCandlestickChart(ctx, priceHistory, rect.width, rect.height);
    
    if (showEMA) {
      drawEMALines(ctx, priceHistory, rect.width, rect.height);
    }
    
    if (showVolume) {
      drawVolumeChart(ctx, priceHistory, rect.width, rect.height);
    }
    
    if (showSignals) {
      drawSignals(ctx, priceHistory, rect.width, rect.height);
    }

  }, [priceHistory, showEMA, showVolume, showStochRSI, showSignals]);

  const drawCandlestickChart = (ctx: CanvasRenderingContext2D, data: any[], width: number, height: number) => {
    if (data.length === 0) return;

    const chartHeight = height * 0.7; // Reserve space for volume
    const prices = data.map(d => [d.high, d.low, d.open, d.close]).flat();
    const minPrice = Math.min(...prices);
    const maxPrice = Math.max(...prices);
    const priceRange = maxPrice - minPrice;

    const candleWidth = Math.max(2, width / data.length * 0.8);
    const candleSpacing = width / data.length;

    data.forEach((candle, i) => {
      const x = i * candleSpacing + candleSpacing / 2;
      
      // Normalize prices to canvas coordinates
      const high = (1 - (candle.high - minPrice) / priceRange) * chartHeight;
      const low = (1 - (candle.low - minPrice) / priceRange) * chartHeight;
      const open = (1 - (candle.open - minPrice) / priceRange) * chartHeight;
      const close = (1 - (candle.close - minPrice) / priceRange) * chartHeight;

      const isGreen = candle.close >= candle.open;

      // Draw wick
      ctx.strokeStyle = isGreen ? '#10b981' : '#ef4444';
      ctx.lineWidth = 1;
      ctx.beginPath();
      ctx.moveTo(x, high);
      ctx.lineTo(x, low);
      ctx.stroke();

      // Draw body
      ctx.fillStyle = isGreen ? '#10b981' : '#ef4444';
      const bodyHeight = Math.abs(close - open);
      const bodyTop = Math.min(open, close);
      
      if (bodyHeight < 1) {
        // Doji - draw line
        ctx.strokeStyle = isGreen ? '#10b981' : '#ef4444';
        ctx.beginPath();
        ctx.moveTo(x - candleWidth / 2, open);
        ctx.lineTo(x + candleWidth / 2, open);
        ctx.stroke();
      } else {
        ctx.fillRect(x - candleWidth / 2, bodyTop, candleWidth, bodyHeight);
      }
    });
  };

  const drawEMALines = (ctx: CanvasRenderingContext2D, data: any[], width: number, height: number) => {
    if (data.length < 50) return;

    const chartHeight = height * 0.7;
    const prices = data.map(d => d.close);
    
    // Calculate EMA50 and EMA200
    const ema50 = calculateEMA(prices, 50);
    const ema200 = calculateEMA(prices, 200);
    
    const allPrices = data.map(d => [d.high, d.low, d.open, d.close]).flat();
    const minPrice = Math.min(...allPrices);
    const maxPrice = Math.max(...allPrices);
    const priceRange = maxPrice - minPrice;

    const candleSpacing = width / data.length;

    // Draw EMA50
    if (ema50.length > 0) {
      ctx.strokeStyle = '#3b82f6';
      ctx.lineWidth = 2;
      ctx.beginPath();
      ema50.forEach((price, i) => {
        if (price === null) return;
        const x = i * candleSpacing + candleSpacing / 2;
        const y = (1 - (price - minPrice) / priceRange) * chartHeight;
        if (i === 0) {
          ctx.moveTo(x, y);
        } else {
          ctx.lineTo(x, y);
        }
      });
      ctx.stroke();
    }

    // Draw EMA200
    if (ema200.length > 0) {
      ctx.strokeStyle = '#8b5cf6';
      ctx.lineWidth = 2;
      ctx.beginPath();
      ema200.forEach((price, i) => {
        if (price === null) return;
        const x = i * candleSpacing + candleSpacing / 2;
        const y = (1 - (price - minPrice) / priceRange) * chartHeight;
        if (i === 0) {
          ctx.moveTo(x, y);
        } else {
          ctx.lineTo(x, y);
        }
      });
      ctx.stroke();
    }
  };

  const drawVolumeChart = (ctx: CanvasRenderingContext2D, data: any[], width: number, height: number) => {
    const volumeHeight = height * 0.25;
    const volumeTop = height * 0.75;
    
    const volumes = data.map(d => d.volume);
    const maxVolume = Math.max(...volumes);
    
    const candleSpacing = width / data.length;
    const barWidth = candleSpacing * 0.6;

    data.forEach((candle, i) => {
      const x = i * candleSpacing + candleSpacing / 2;
      const barHeight = (candle.volume / maxVolume) * volumeHeight;
      
      const isGreen = candle.close >= candle.open;
      ctx.fillStyle = isGreen ? 'rgba(16, 185, 129, 0.7)' : 'rgba(239, 68, 68, 0.7)';
      
      ctx.fillRect(x - barWidth / 2, volumeTop + volumeHeight - barHeight, barWidth, barHeight);
    });

    // Volume label
    ctx.fillStyle = '#64748b';
    ctx.font = '12px Inter';
    ctx.textAlign = 'left';
    ctx.fillText('Volume', 10, volumeTop + 15);
  };

  const drawSignals = (ctx: CanvasRenderingContext2D, data: any[], width: number, height: number) => {
    // Simulate some signals for demonstration
    const chartHeight = height * 0.7;
    const candleSpacing = width / data.length;
    
    // Add buy/sell signal indicators
    data.forEach((candle, i) => {
      if (i % 20 === 0) { // Simulate signals every 20 candles
        const x = i * candleSpacing + candleSpacing / 2;
        const isLong = Math.random() > 0.5;
        
        const allPrices = data.map(d => [d.high, d.low, d.open, d.close]).flat();
        const minPrice = Math.min(...allPrices);
        const maxPrice = Math.max(...allPrices);
        const priceRange = maxPrice - minPrice;
        
        const y = isLong 
          ? (1 - (candle.low - minPrice) / priceRange) * chartHeight + 10
          : (1 - (candle.high - minPrice) / priceRange) * chartHeight - 10;

        // Draw signal arrow
        ctx.fillStyle = isLong ? '#10b981' : '#ef4444';
        ctx.beginPath();
        if (isLong) {
          ctx.moveTo(x, y);
          ctx.lineTo(x - 5, y + 8);
          ctx.lineTo(x + 5, y + 8);
        } else {
          ctx.moveTo(x, y);
          ctx.lineTo(x - 5, y - 8);
          ctx.lineTo(x + 5, y - 8);
        }
        ctx.closePath();
        ctx.fill();
      }
    });
  };

  const calculateEMA = (prices: number[], period: number): number[] => {
    const ema: number[] = [];
    const multiplier = 2 / (period + 1);
    
    for (let i = 0; i < prices.length; i++) {
      if (i === 0) {
        ema.push(prices[i]);
      } else {
        ema.push((prices[i] * multiplier) + (ema[i - 1] * (1 - multiplier)));
      }
    }
    
    return ema;
  };

  return (
    <Card className="p-4">
      <div className="flex items-center justify-between mb-4">
        <h3 className="font-semibold">Price Chart & Technical Analysis</h3>
        <div className="flex items-center space-x-2">
          <Select value={timeframe} onValueChange={setTimeframe}>
            <SelectTrigger className="w-20" data-testid="select-timeframe">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="5m">5m</SelectItem>
              <SelectItem value="15m">15m</SelectItem>
              <SelectItem value="1h">1h</SelectItem>
              <SelectItem value="4h">4h</SelectItem>
              <SelectItem value="1d">1d</SelectItem>
            </SelectContent>
          </Select>
          <Button variant="outline" size="sm" data-testid="button-expand-chart">
            <Expand className="h-4 w-4" />
          </Button>
        </div>
      </div>
      
      <div className="chart-container">
        {isLoading ? (
          <div className="chart-loading">
            <Activity className="h-8 w-8 animate-pulse" />
            <div className="mt-2 text-sm">Loading chart data...</div>
          </div>
        ) : (
          <canvas 
            ref={canvasRef} 
            className="w-full h-full"
            style={{ width: '100%', height: '100%' }}
          />
        )}
      </div>
      
      <div className="flex items-center justify-between mt-4">
        <div className="flex items-center space-x-4 text-sm">
          <label className="flex items-center space-x-2 cursor-pointer">
            <Checkbox 
              checked={showEMA} 
              onCheckedChange={(checked) => setShowEMA(checked === true)}
              data-testid="checkbox-ema"
            />
            <span>EMA Ribbons</span>
          </label>
          <label className="flex items-center space-x-2 cursor-pointer">
            <Checkbox 
              checked={showVolume} 
              onCheckedChange={(checked) => setShowVolume(checked === true)}
              data-testid="checkbox-volume"
            />
            <span>Volume</span>
          </label>
          <label className="flex items-center space-x-2 cursor-pointer">
            <Checkbox 
              checked={showStochRSI} 
              onCheckedChange={(checked) => setShowStochRSI(checked === true)}
              data-testid="checkbox-stochrsi"
            />
            <span>StochRSI</span>
          </label>
          <label className="flex items-center space-x-2 cursor-pointer">
            <Checkbox 
              checked={showSignals} 
              onCheckedChange={(checked) => setShowSignals(checked === true)}
              data-testid="checkbox-signals"
            />
            <span>Signals</span>
          </label>
        </div>
        <div className="text-xs text-muted-foreground">
          Last updated: <span data-testid="chart-last-update">{new Date().toLocaleTimeString()}</span>
        </div>
      </div>
    </Card>
  );
}
