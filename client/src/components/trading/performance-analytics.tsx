import { Card } from "@/components/ui/card";
import type { RiskMetrics } from "@shared/schema";

interface PerformanceData {
  totalPnL?: number;
  winRate?: number;
  totalTrades?: number;
  maxDrawdown?: number;
  avgWin?: number;
  avgLoss?: number;
}

interface PerformanceAnalyticsProps {
  riskMetrics?: RiskMetrics;
  performanceData?: PerformanceData;
}

export default function PerformanceAnalytics({ 
  riskMetrics, 
  performanceData 
}: PerformanceAnalyticsProps) {
  
  const formatCurrency = (value: number | undefined) => {
    if (value === undefined) return '$0.00';
    const isPositive = value >= 0;
    return `${isPositive ? '+' : ''}$${Math.abs(value).toFixed(2)}`;
  };

  const formatPercentage = (value: number | undefined) => {
    if (value === undefined) return '0.0%';
    return `${value.toFixed(1)}%`;
  };

  const formatRatio = (value: number | undefined) => {
    if (value === undefined) return '0.0';
    return value.toFixed(2);
  };

  const getPnLClass = (value: number | undefined) => {
    if (value === undefined || value === 0) return 'pnl-neutral';
    return value > 0 ? 'pnl-positive' : 'pnl-negative';
  };

  // Mock accuracy data for demonstration
  const accuracyData = {
    accuracy7d: 72.1,
    accuracy30d: 69.8,
    precision: 74.3,
    recall: 67.9
  };

  return (
    <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
      {/* Today's Performance */}
      <Card className="p-4">
        <h4 className="font-semibold text-sm mb-3">Today's Performance</h4>
        <div className="space-y-2">
          <div className="flex justify-between">
            <span className="text-sm text-muted-foreground">Realized P&L:</span>
            <span 
              data-testid="realized-pnl"
              className={`font-mono ${getPnLClass(performanceData?.totalPnL)}`}
            >
              {formatCurrency(performanceData?.totalPnL)}
            </span>
          </div>
          <div className="flex justify-between">
            <span className="text-sm text-muted-foreground">Win Rate:</span>
            <span 
              data-testid="win-rate"
              className="font-mono"
            >
              {formatPercentage(performanceData?.winRate)}
            </span>
          </div>
          <div className="flex justify-between">
            <span className="text-sm text-muted-foreground">Trades:</span>
            <span 
              data-testid="trades-count"
              className="font-mono"
            >
              {performanceData?.totalTrades || 0}
            </span>
          </div>
          <div className="flex justify-between">
            <span className="text-sm text-muted-foreground">Max DD:</span>
            <span 
              data-testid="max-drawdown"
              className="font-mono text-red-500"
            >
              -{formatPercentage(Math.abs(performanceData?.maxDrawdown || 0))}
            </span>
          </div>
        </div>
      </Card>

      {/* Risk Metrics */}
      <Card className="p-4">
        <h4 className="font-semibold text-sm mb-3">Risk Metrics</h4>
        <div className="space-y-2">
          <div className="flex justify-between">
            <span className="text-sm text-muted-foreground">Sharpe Ratio:</span>
            <span 
              data-testid="sharpe-ratio"
              className="font-mono"
            >
              {formatRatio(riskMetrics?.sharpeRatio)}
            </span>
          </div>
          <div className="flex justify-between">
            <span className="text-sm text-muted-foreground">Risk/Reward:</span>
            <span 
              data-testid="risk-reward"
              className="font-mono"
            >
              1:{formatRatio(riskMetrics?.riskReward)}
            </span>
          </div>
          <div className="flex justify-between">
            <span className="text-sm text-muted-foreground">Volatility:</span>
            <span 
              data-testid="volatility"
              className="font-mono"
            >
              {formatPercentage(riskMetrics?.volatility)}
            </span>
          </div>
          <div className="flex justify-between">
            <span className="text-sm text-muted-foreground">Beta:</span>
            <span 
              data-testid="beta"
              className="font-mono"
            >
              {formatRatio(riskMetrics?.beta)}
            </span>
          </div>
        </div>
      </Card>

      {/* Model Accuracy */}
      <Card className="p-4">
        <h4 className="font-semibold text-sm mb-3">Model Accuracy</h4>
        <div className="space-y-2">
          <div className="flex justify-between">
            <span className="text-sm text-muted-foreground">7-Day Accuracy:</span>
            <span 
              data-testid="accuracy-7d"
              className="font-mono text-green-500"
            >
              {formatPercentage(accuracyData.accuracy7d)}
            </span>
          </div>
          <div className="flex justify-between">
            <span className="text-sm text-muted-foreground">30-Day Accuracy:</span>
            <span 
              data-testid="accuracy-30d"
              className="font-mono text-green-500"
            >
              {formatPercentage(accuracyData.accuracy30d)}
            </span>
          </div>
          <div className="flex justify-between">
            <span className="text-sm text-muted-foreground">Precision:</span>
            <span 
              data-testid="precision"
              className="font-mono"
            >
              {formatPercentage(accuracyData.precision)}
            </span>
          </div>
          <div className="flex justify-between">
            <span className="text-sm text-muted-foreground">Recall:</span>
            <span 
              data-testid="recall"
              className="font-mono"
            >
              {formatPercentage(accuracyData.recall)}
            </span>
          </div>
        </div>
      </Card>
    </div>
  );
}
