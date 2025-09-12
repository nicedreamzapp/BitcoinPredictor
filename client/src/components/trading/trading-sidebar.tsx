import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Progress } from "@/components/ui/progress";
import { Badge } from "@/components/ui/badge";
import { StopCircle, Pause, Play, Activity } from "lucide-react";
import type { ConfidenceScore, TradingSignal, Trade } from "@shared/schema";

interface TradingSidebarProps {
  confidence?: ConfidenceScore;
  activeTrades?: Trade[];
  recentSignals?: TradingSignal[];
  strategyStatus?: {
    active: boolean;
    weights: {
      momentum: number;
      volume: number;
      trend: number;
      volatility: number;
    };
  };
  onEmergencyStop: () => void;
  onToggleStrategy: (active: boolean) => void;
}

export default function TradingSidebar({
  confidence,
  activeTrades = [],
  recentSignals = [],
  strategyStatus,
  onEmergencyStop,
  onToggleStrategy
}: TradingSidebarProps) {
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

  // Calculate position summary
  const currentPosition = activeTrades.length > 0 ? activeTrades[0] : null;
  const totalPnL = activeTrades.reduce((sum, trade) => sum + (trade.pnl || 0), 0);

  return (
    <aside className="bg-card overflow-y-auto">
      <div className="p-4 space-y-6">
        {/* Strategy Status */}
        <div className="space-y-3">
          <h3 className="font-semibold text-sm uppercase tracking-wide text-muted-foreground">
            Strategy Status
          </h3>
          <Card className="bg-muted/50 p-3">
            <div className="flex items-center justify-between mb-2">
              <span className="text-sm">Confidence Engine</span>
              <div className="flex items-center space-x-1">
                <Activity className={`w-2 h-2 ${strategyStatus?.active ? 'text-green-500' : 'text-red-500'}`} />
                <span className={`text-xs font-medium ${strategyStatus?.active ? 'text-green-500' : 'text-red-500'}`}>
                  {strategyStatus?.active ? 'ACTIVE' : 'INACTIVE'}
                </span>
              </div>
            </div>
            {confidence ? (
              <div className="space-y-1">
                <div className="flex justify-between text-xs">
                  <span>Long Signal</span>
                  <span 
                    data-testid="long-confidence-sidebar"
                    className="text-green-500 font-mono"
                  >
                    {Math.round(confidence.longConfidence)}%
                  </span>
                </div>
                <div className="flex justify-between text-xs">
                  <span>Short Signal</span>
                  <span 
                    data-testid="short-confidence-sidebar"
                    className="text-red-500 font-mono"
                  >
                    {Math.round(confidence.shortConfidence)}%
                  </span>
                </div>
              </div>
            ) : (
              <div className="space-y-1">
                <div className="skeleton h-3 w-full rounded"></div>
                <div className="skeleton h-3 w-full rounded"></div>
              </div>
            )}
          </Card>
        </div>

        {/* Current Position */}
        <div className="space-y-3">
          <h3 className="font-semibold text-sm uppercase tracking-wide text-muted-foreground">
            Position
          </h3>
          <Card className={`p-3 ${currentPosition ? (currentPosition.side === 'LONG' ? 'position-long' : 'position-short') : 'bg-secondary/30'}`}>
            {currentPosition ? (
              <>
                <div className="flex items-center justify-between mb-2">
                  <span className="text-sm font-medium">BTC/USD</span>
                  <Badge 
                    variant={currentPosition.side === 'LONG' ? 'default' : 'destructive'}
                    className="text-xs"
                  >
                    {currentPosition.side}
                  </Badge>
                </div>
                <div className="space-y-2 text-sm">
                  <div className="flex justify-between">
                    <span className="text-muted-foreground">Size:</span>
                    <span 
                      data-testid="position-size"
                      className="font-mono"
                    >
                      {currentPosition.quantity} BTC
                    </span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-muted-foreground">Entry:</span>
                    <span 
                      data-testid="entry-price"
                      className="font-mono"
                    >
                      ${currentPosition.entryPrice.toFixed(2)}
                    </span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-muted-foreground">P&L:</span>
                    <span 
                      data-testid="unrealized-pnl"
                      className={`font-mono ${getPnLClass(currentPosition.pnl)}`}
                    >
                      {formatPnL(currentPosition.pnl)}
                    </span>
                  </div>
                </div>
              </>
            ) : (
              <div className="text-center py-4 text-muted-foreground">
                <span className="text-sm">No active position</span>
              </div>
            )}
          </Card>
        </div>

        {/* Recent Signals */}
        <div className="space-y-3">
          <h3 className="font-semibold text-sm uppercase tracking-wide text-muted-foreground">
            Recent Signals
          </h3>
          <div className="space-y-2 max-h-60 overflow-y-auto">
            {recentSignals.length > 0 ? (
              recentSignals.slice(0, 5).map((signal) => (
                <Card 
                  key={signal.id}
                  className={`p-3 border-l-4 ${signal.signalType === 'LONG' ? 'border-green-500 bg-green-500/5' : 'border-red-500 bg-red-500/5'}`}
                >
                  <div className="flex items-center justify-between mb-1">
                    <span className={`text-xs font-semibold ${signal.signalType === 'LONG' ? 'text-green-500' : 'text-red-500'}`}>
                      {signal.signalType === 'LONG' ? 'BUY SIGNAL' : 'SELL SIGNAL'}
                    </span>
                    <span className="text-xs text-muted-foreground">
                      {formatTime(signal.timestamp)}
                    </span>
                  </div>
                  <div className="text-xs space-y-1">
                    <div>
                      Confidence: <span className={`font-mono ${signal.signalType === 'LONG' ? 'text-green-500' : 'text-red-500'}`}>
                        {Math.round(signal.confidence * 100)}%
                      </span>
                    </div>
                    <div>Entry: <span className="font-mono">${signal.price.toFixed(2)}</span></div>
                    {signal.stopLoss && (
                      <div>Stop: <span className="font-mono">${signal.stopLoss.toFixed(2)}</span></div>
                    )}
                  </div>
                </Card>
              ))
            ) : (
              <div className="text-center py-4 text-muted-foreground text-sm">
                No recent signals
              </div>
            )}
          </div>
        </div>

        {/* Strategy Weights */}
        <div className="space-y-3">
          <h3 className="font-semibold text-sm uppercase tracking-wide text-muted-foreground">
            Model Weights
          </h3>
          {strategyStatus?.weights ? (
            <div className="space-y-3">
              <div className="space-y-1">
                <div className="flex justify-between text-xs">
                  <span>Momentum (StochRSI)</span>
                  <span className="font-mono">{Math.round(strategyStatus.weights.momentum * 100)}%</span>
                </div>
                <Progress value={strategyStatus.weights.momentum * 100} className="h-1" />
              </div>
              <div className="space-y-1">
                <div className="flex justify-between text-xs">
                  <span>Volume Analysis</span>
                  <span className="font-mono">{Math.round(strategyStatus.weights.volume * 100)}%</span>
                </div>
                <Progress value={strategyStatus.weights.volume * 100} className="h-1" />
              </div>
              <div className="space-y-1">
                <div className="flex justify-between text-xs">
                  <span>Trend (EMA)</span>
                  <span className="font-mono">{Math.round(strategyStatus.weights.trend * 100)}%</span>
                </div>
                <Progress value={strategyStatus.weights.trend * 100} className="h-1" />
              </div>
              <div className="space-y-1">
                <div className="flex justify-between text-xs">
                  <span>Volatility</span>
                  <span className="font-mono">{Math.round(strategyStatus.weights.volatility * 100)}%</span>
                </div>
                <Progress value={strategyStatus.weights.volatility * 100} className="h-1" />
              </div>
            </div>
          ) : (
            <div className="space-y-3">
              {Array.from({ length: 4 }).map((_, i) => (
                <div key={i} className="space-y-1">
                  <div className="skeleton h-3 w-full rounded"></div>
                  <div className="skeleton h-1 w-full rounded"></div>
                </div>
              ))}
            </div>
          )}
        </div>

        {/* Quick Controls */}
        <div className="space-y-3">
          <h3 className="font-semibold text-sm uppercase tracking-wide text-muted-foreground">
            Quick Controls
          </h3>
          <div className="space-y-2">
            <Button 
              onClick={onEmergencyStop}
              variant="destructive"
              size="sm"
              className="w-full"
              data-testid="button-emergency-stop"
            >
              <StopCircle className="w-4 h-4 mr-2" />
              Emergency Stop
            </Button>
            <Button 
              onClick={() => onToggleStrategy(!strategyStatus?.active)}
              variant="default"
              size="sm"
              className="w-full"
              data-testid="button-toggle-strategy"
            >
              {strategyStatus?.active ? (
                <><Pause className="w-4 h-4 mr-2" />Pause Strategy</>
              ) : (
                <><Play className="w-4 h-4 mr-2" />Resume Strategy</>
              )}
            </Button>
          </div>
        </div>
      </div>
    </aside>
  );
}
