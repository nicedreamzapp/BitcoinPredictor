import { Card } from "@/components/ui/card";
import { Bitcoin, TrendingUp, TrendingDown } from "lucide-react";
import type { LivePriceUpdate } from "@shared/schema";

interface PriceHeaderProps {
  currentPrice?: LivePriceUpdate;
}

export default function PriceHeader({ currentPrice }: PriceHeaderProps) {
  if (!currentPrice) {
    return (
      <Card className="p-4">
        <div className="flex items-center justify-between">
          <div className="flex items-center space-x-4">
            <div className="flex items-center space-x-2">
              <Bitcoin className="h-8 w-8 text-yellow-500" />
              <h2 className="text-2xl font-bold">BTC/USD</h2>
            </div>
            <div className="flex items-center space-x-3">
              <div className="skeleton h-8 w-32 rounded"></div>
              <div className="flex flex-col space-y-1">
                <div className="skeleton h-5 w-24 rounded"></div>
                <div className="skeleton h-4 w-20 rounded"></div>
              </div>
            </div>
          </div>
          <div className="flex items-center space-x-6 text-sm">
            <div className="text-center space-y-1">
              <div className="text-muted-foreground">24h High</div>
              <div className="skeleton h-4 w-16 rounded"></div>
            </div>
            <div className="text-center space-y-1">
              <div className="text-muted-foreground">24h Low</div>
              <div className="skeleton h-4 w-16 rounded"></div>
            </div>
            <div className="text-center space-y-1">
              <div className="text-muted-foreground">Volume</div>
              <div className="skeleton h-4 w-12 rounded"></div>
            </div>
          </div>
        </div>
      </Card>
    );
  }

  const isPositive = currentPrice.changePercent24h >= 0;
  const Icon = isPositive ? TrendingUp : TrendingDown;
  const colorClass = isPositive ? "price-up" : "price-down";

  return (
    <Card className="p-4">
      <div className="flex items-center justify-between">
        <div className="flex items-center space-x-4">
          <div className="flex items-center space-x-2">
            <Bitcoin className="h-8 w-8 text-yellow-500" />
            <h2 className="text-2xl font-bold">BTC/USD</h2>
          </div>
          <div className="flex items-center space-x-3">
            <span 
              data-testid="current-price"
              className={`text-3xl font-mono font-bold ${colorClass}`}
            >
              ${currentPrice.price.toFixed(2)}
            </span>
            <div className="flex flex-col">
              <div className={`flex items-center space-x-1 ${colorClass}`}>
                <Icon className="h-4 w-4" />
                <span 
                  data-testid="price-change"
                  className="text-lg font-mono"
                >
                  ${Math.abs(currentPrice.change24h).toFixed(2)}
                </span>
              </div>
              <span 
                data-testid="price-change-percent"
                className={`text-sm font-mono ${colorClass}`}
              >
                {isPositive ? '+' : ''}{currentPrice.changePercent24h.toFixed(2)}%
              </span>
            </div>
          </div>
        </div>
        
        <div className="flex items-center space-x-6 text-sm">
          <div className="text-center">
            <div className="text-muted-foreground">24h High</div>
            <div data-testid="day-high" className="font-mono font-semibold">
              ${currentPrice.high24h.toFixed(0)}
            </div>
          </div>
          <div className="text-center">
            <div className="text-muted-foreground">24h Low</div>
            <div data-testid="day-low" className="font-mono font-semibold">
              ${currentPrice.low24h.toFixed(0)}
            </div>
          </div>
          <div className="text-center">
            <div className="text-muted-foreground">Volume</div>
            <div data-testid="volume" className="font-mono font-semibold">
              {(currentPrice.volume24h / 1e9).toFixed(1)}B
            </div>
          </div>
        </div>
      </div>
    </Card>
  );
}
