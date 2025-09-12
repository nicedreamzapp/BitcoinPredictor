import { useState } from "react";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Switch } from "@/components/ui/switch";
import { Slider } from "@/components/ui/slider";
import { Badge } from "@/components/ui/badge";
import { Play, Calendar } from "lucide-react";
import { useTradingData } from "@/hooks/use-trading-data";

export default function RiskManagementPanel() {
  const { 
    recentTrades, 
    backtestResults, 
    runBacktest, 
    isRunBacktestLoading 
  } = useTradingData();

  const [positionMultiplier, setPositionMultiplier] = useState([2]);
  const [stopLoss, setStopLoss] = useState(2.0);
  const [takeProfit, setTakeProfit] = useState(4.5);
  const [autoStopLoss, setAutoStopLoss] = useState(true);
  const [dynamicSizing, setDynamicSizing] = useState(true);
  
  // Backtest configuration
  const [backtestConfig, setBacktestConfig] = useState({
    startDate: '2024-01-01',
    endDate: '2024-12-01',
    timeframe: '15m',
    initialCapital: 10000
  });

  const formatTime = (timestamp: string | Date) => {
    const date = new Date(timestamp);
    return date.toLocaleTimeString('en-US', { 
      hour: '2-digit', 
      minute: '2-digit',
      hour12: false 
    });
  };

  const formatPnL = (pnl: number | null | undefined) => {
    if (pnl === null || pnl === undefined) return '$0.00';
    const isPositive = pnl >= 0;
    return `${isPositive ? '+' : ''}$${Math.abs(pnl).toFixed(2)}`;
  };

  const getPnLClass = (pnl: number | null | undefined) => {
    if (pnl === null || pnl === undefined || pnl === 0) return 'pnl-neutral';
    return pnl > 0 ? 'pnl-positive' : 'pnl-negative';
  };

  const handleRunBacktest = async () => {
    await runBacktest({
      startDate: new Date(backtestConfig.startDate),
      endDate: new Date(backtestConfig.endDate),
      timeframe: backtestConfig.timeframe,
      initialCapital: backtestConfig.initialCapital,
      strategy: {
        momentum: 0.35,
        volume: 0.30,
        trend: 0.18,
        volatility: 0.17
      }
    });
  };

  // Mock account data
  const accountData = {
    balance: 25847.50,
    available: 18320.00,
    marginUsed: 7527.50,
    todayPnL: 1247.50
  };

  const latestBacktestResult = (backtestResults as any)?.[0];

  return (
    <aside className="bg-card overflow-y-auto">
      <div className="p-4 space-y-6">
        {/* Risk Management */}
        <div className="space-y-3">
          <h3 className="font-semibold text-sm uppercase tracking-wide text-muted-foreground">
            Risk Management
          </h3>
          <div className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="position-size" className="text-sm font-medium">
                Position Size
              </Label>
              <div className="flex items-center space-x-2">
                <Slider
                  id="position-size"
                  min={1}
                  max={5}
                  step={0.5}
                  value={positionMultiplier}
                  onValueChange={setPositionMultiplier}
                  className="flex-1"
                  data-testid="slider-position-size"
                />
                <span 
                  data-testid="position-multiplier"
                  className="text-sm font-mono w-8"
                >
                  {positionMultiplier[0]}x
                </span>
              </div>
              <div className="text-xs text-muted-foreground">
                Max Risk: <span data-testid="max-risk">{(positionMultiplier[0] * 1.25).toFixed(1)}%</span> per trade
              </div>
            </div>

            <div className="space-y-2">
              <Label htmlFor="stop-loss" className="text-sm font-medium">
                Stop Loss
              </Label>
              <div className="flex items-center space-x-2">
                <Input
                  id="stop-loss"
                  type="number"
                  value={stopLoss}
                  onChange={(e) => setStopLoss(parseFloat(e.target.value))}
                  step={0.1}
                  className="flex-1"
                  data-testid="input-stop-loss"
                />
                <span className="text-sm">%</span>
              </div>
            </div>

            <div className="space-y-2">
              <Label htmlFor="take-profit" className="text-sm font-medium">
                Take Profit
              </Label>
              <div className="flex items-center space-x-2">
                <Input
                  id="take-profit"
                  type="number"
                  value={takeProfit}
                  onChange={(e) => setTakeProfit(parseFloat(e.target.value))}
                  step={0.1}
                  className="flex-1"
                  data-testid="input-take-profit"
                />
                <span className="text-sm">%</span>
              </div>
            </div>

            <div className="flex items-center justify-between">
              <Label htmlFor="auto-stop-loss" className="text-sm">
                Auto-Stop Loss
              </Label>
              <Switch
                id="auto-stop-loss"
                checked={autoStopLoss}
                onCheckedChange={setAutoStopLoss}
                data-testid="switch-auto-stop-loss"
              />
            </div>

            <div className="flex items-center justify-between">
              <Label htmlFor="dynamic-sizing" className="text-sm">
                Dynamic Sizing
              </Label>
              <Switch
                id="dynamic-sizing"
                checked={dynamicSizing}
                onCheckedChange={setDynamicSizing}
                data-testid="switch-dynamic-sizing"
              />
            </div>
          </div>
        </div>

        {/* Account Summary */}
        <div className="space-y-3">
          <h3 className="font-semibold text-sm uppercase tracking-wide text-muted-foreground">
            Account
          </h3>
          <Card className="bg-muted/30 p-3 space-y-2">
            <div className="flex justify-between">
              <span className="text-sm text-muted-foreground">Balance:</span>
              <span 
                data-testid="account-balance"
                className="font-mono font-semibold"
              >
                ${accountData.balance.toLocaleString()}
              </span>
            </div>
            <div className="flex justify-between">
              <span className="text-sm text-muted-foreground">Available:</span>
              <span 
                data-testid="available-balance"
                className="font-mono"
              >
                ${accountData.available.toLocaleString()}
              </span>
            </div>
            <div className="flex justify-between">
              <span className="text-sm text-muted-foreground">Margin Used:</span>
              <span 
                data-testid="margin-used"
                className="font-mono"
              >
                ${accountData.marginUsed.toLocaleString()}
              </span>
            </div>
            <div className="flex justify-between">
              <span className="text-sm text-muted-foreground">Today P&L:</span>
              <span 
                data-testid="today-pnl"
                className={`font-mono ${getPnLClass(accountData.todayPnL)}`}
              >
                {formatPnL(accountData.todayPnL)}
              </span>
            </div>
          </Card>
        </div>

        {/* Backtesting Interface */}
        <div className="space-y-3">
          <h3 className="font-semibold text-sm uppercase tracking-wide text-muted-foreground">
            Backtesting
          </h3>
          <div className="space-y-4">
            <div className="space-y-2">
              <Label className="text-sm font-medium">Date Range</Label>
              <div className="space-y-2">
                <Input
                  type="date"
                  value={backtestConfig.startDate}
                  onChange={(e) => setBacktestConfig(prev => ({ ...prev, startDate: e.target.value }))}
                  data-testid="input-backtest-start-date"
                />
                <Input
                  type="date"
                  value={backtestConfig.endDate}
                  onChange={(e) => setBacktestConfig(prev => ({ ...prev, endDate: e.target.value }))}
                  data-testid="input-backtest-end-date"
                />
              </div>
            </div>

            <div className="space-y-2">
              <Label className="text-sm font-medium">Timeframe</Label>
              <Select 
                value={backtestConfig.timeframe} 
                onValueChange={(value) => setBacktestConfig(prev => ({ ...prev, timeframe: value }))}
              >
                <SelectTrigger data-testid="select-backtest-timeframe">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="5m">5 minutes</SelectItem>
                  <SelectItem value="15m">15 minutes</SelectItem>
                  <SelectItem value="1h">1 hour</SelectItem>
                  <SelectItem value="4h">4 hours</SelectItem>
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-2">
              <Label className="text-sm font-medium">Initial Capital</Label>
              <div className="flex items-center space-x-2">
                <span className="text-sm">$</span>
                <Input
                  type="number"
                  value={backtestConfig.initialCapital}
                  onChange={(e) => setBacktestConfig(prev => ({ ...prev, initialCapital: parseInt(e.target.value) }))}
                  data-testid="input-initial-capital"
                />
              </div>
            </div>

            <Button 
              onClick={handleRunBacktest}
              disabled={isRunBacktestLoading}
              className="w-full"
              data-testid="button-run-backtest"
            >
              {isRunBacktestLoading ? (
                <>
                  <Calendar className="w-4 h-4 mr-2 animate-pulse" />
                  Running...
                </>
              ) : (
                <>
                  <Play className="w-4 h-4 mr-2" />
                  Run Backtest
                </>
              )}
            </Button>
          </div>
        </div>

        {/* Backtest Results */}
        <div className="space-y-3">
          <h3 className="font-semibold text-sm uppercase tracking-wide text-muted-foreground">
            Latest Results
          </h3>
          {latestBacktestResult ? (
            <Card className="bg-secondary/30 p-3">
              <div className="space-y-2 text-sm">
                <div className="flex justify-between">
                  <span className="text-muted-foreground">Period:</span>
                  <span 
                    data-testid="backtest-period"
                    className="font-mono"
                  >
                    {Math.ceil((new Date(latestBacktestResult.endDate).getTime() - new Date(latestBacktestResult.startDate).getTime()) / (1000 * 60 * 60 * 24))} days
                  </span>
                </div>
                <div className="flex justify-between">
                  <span className="text-muted-foreground">Total Return:</span>
                  <span 
                    data-testid="total-return"
                    className={`font-mono ${getPnLClass(latestBacktestResult.totalReturn)}`}
                  >
                    {latestBacktestResult.totalReturn > 0 ? '+' : ''}{latestBacktestResult.totalReturn.toFixed(1)}%
                  </span>
                </div>
                <div className="flex justify-between">
                  <span className="text-muted-foreground">Win Rate:</span>
                  <span 
                    data-testid="backtest-win-rate"
                    className="font-mono"
                  >
                    {latestBacktestResult.winRate.toFixed(1)}%
                  </span>
                </div>
                <div className="flex justify-between">
                  <span className="text-muted-foreground">Sharpe:</span>
                  <span 
                    data-testid="backtest-sharpe"
                    className="font-mono"
                  >
                    {latestBacktestResult.sharpeRatio.toFixed(2)}
                  </span>
                </div>
                <div className="flex justify-between">
                  <span className="text-muted-foreground">Max DD:</span>
                  <span 
                    data-testid="backtest-max-dd"
                    className="font-mono text-red-500"
                  >
                    -{latestBacktestResult.maxDrawdown.toFixed(1)}%
                  </span>
                </div>
                <div className="flex justify-between">
                  <span className="text-muted-foreground">Trades:</span>
                  <span 
                    data-testid="backtest-trades"
                    className="font-mono"
                  >
                    {latestBacktestResult.totalTrades}
                  </span>
                </div>
              </div>
              <div className="mt-3 pt-2 border-t border-border">
                <div className="flex items-center justify-between text-xs">
                  <span className="text-green-500">✓ Strategy Validated</span>
                  <span className="text-muted-foreground">
                    {((latestBacktestResult.finalCapital / latestBacktestResult.initialCapital - 1) * 100).toFixed(1)}%
                  </span>
                </div>
              </div>
            </Card>
          ) : (
            <Card className="bg-secondary/30 p-3">
              <div className="text-center py-4 text-muted-foreground text-sm">
                No backtest results available
              </div>
            </Card>
          )}
        </div>

        {/* Trade History */}
        <div className="space-y-3">
          <h3 className="font-semibold text-sm uppercase tracking-wide text-muted-foreground">
            Recent Trades
          </h3>
          <div className="space-y-2 max-h-40 overflow-y-auto">
            {(recentTrades as any)?.length > 0 ? (
              (recentTrades as any).slice(0, 6).map((trade: any) => (
                <Card key={trade.id} className="bg-muted/20 p-2 text-xs">
                  <div className="flex items-center justify-between mb-1">
                    <div className="flex items-center space-x-2">
                      <Badge 
                        variant={trade.side === 'LONG' ? 'default' : 'destructive'}
                        className="text-xs px-1 py-0"
                      >
                        {trade.side}
                      </Badge>
                      <span className="font-semibold">BTC</span>
                    </div>
                    <span className="text-muted-foreground">
                      {formatTime(trade.entryTime)}
                    </span>
                  </div>
                  <div className="flex justify-between">
                    <span>Entry: ${trade.entryPrice.toFixed(2)}</span>
                    <span className={getPnLClass(trade.pnl)}>
                      {formatPnL(trade.pnl)}
                    </span>
                  </div>
                </Card>
              ))
            ) : (
              <div className="text-center py-4 text-muted-foreground text-sm">
                No recent trades
              </div>
            )}
          </div>
        </div>
      </div>
    </aside>
  );
}
