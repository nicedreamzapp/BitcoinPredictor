import { Card } from "@/components/ui/card";
import type { ConfidenceScore } from "@shared/schema";

interface ConfidenceEngineProps {
  confidence?: ConfidenceScore;
}

export default function ConfidenceEngine({ confidence }: ConfidenceEngineProps) {
  if (!confidence) {
    return (
      <Card className="p-4">
        <h3 className="font-semibold mb-4">Confidence Engine</h3>
        <div className="space-y-4">
          <div className="space-y-2">
            <div className="flex justify-between text-sm">
              <span>Long Confidence</span>
              <div className="skeleton h-4 w-12 rounded"></div>
            </div>
            <div className="w-full bg-muted rounded-full h-3">
              <div className="skeleton h-3 w-full rounded-full"></div>
            </div>
          </div>
          
          <div className="space-y-2">
            <div className="flex justify-between text-sm">
              <span>Short Confidence</span>
              <div className="skeleton h-4 w-12 rounded"></div>
            </div>
            <div className="w-full bg-muted rounded-full h-3">
              <div className="skeleton h-3 w-full rounded-full"></div>
            </div>
          </div>

          <div className="pt-2 border-t border-border">
            <div className="text-xs text-muted-foreground mb-2">Component Breakdown:</div>
            <div className="grid grid-cols-2 gap-2 text-xs space-y-1">
              <div className="skeleton h-3 w-full rounded"></div>
              <div className="skeleton h-3 w-full rounded"></div>
              <div className="skeleton h-3 w-full rounded"></div>
              <div className="skeleton h-3 w-full rounded"></div>
            </div>
          </div>
        </div>
      </Card>
    );
  }

  return (
    <Card className="p-4">
      <h3 className="font-semibold mb-4">Confidence Engine</h3>
      <div className="space-y-4">
        <div className="space-y-2">
          <div className="flex justify-between text-sm">
            <span>Long Confidence</span>
            <span 
              data-testid="long-confidence-value"
              className="font-mono text-green-500"
            >
              {Math.round(confidence.longConfidence)}%
            </span>
          </div>
          <div className="w-full bg-muted rounded-full h-3 relative">
            <div className="confidence-bar h-3 rounded-full absolute inset-0"></div>
            <div 
              className="bg-green-500 h-3 rounded-full transition-all duration-300" 
              style={{ width: `${confidence.longConfidence}%` }}
            ></div>
          </div>
        </div>
        
        <div className="space-y-2">
          <div className="flex justify-between text-sm">
            <span>Short Confidence</span>
            <span 
              data-testid="short-confidence-value"
              className="font-mono text-red-500"
            >
              {Math.round(confidence.shortConfidence)}%
            </span>
          </div>
          <div className="w-full bg-muted rounded-full h-3 relative">
            <div className="confidence-bar h-3 rounded-full absolute inset-0"></div>
            <div 
              className="bg-red-500 h-3 rounded-full transition-all duration-300" 
              style={{ width: `${confidence.shortConfidence}%` }}
            ></div>
          </div>
        </div>

        <div className="pt-2 border-t border-border">
          <div className="text-xs text-muted-foreground mb-2">Component Breakdown:</div>
          <div className="grid grid-cols-2 gap-2 text-xs">
            <div className="flex justify-between">
              <span>Momentum:</span>
              <span 
                data-testid="momentum-score"
                className="font-mono text-chart-1"
              >
                {confidence.momentumScore > 0 ? '+' : ''}{(confidence.momentumScore || 0).toFixed(2)}
              </span>
            </div>
            <div className="flex justify-between">
              <span>Volume:</span>
              <span 
                data-testid="volume-score"
                className="font-mono text-chart-2"
              >
                {confidence.volumeScore > 0 ? '+' : ''}{(confidence.volumeScore || 0).toFixed(2)}
              </span>
            </div>
            <div className="flex justify-between">
              <span>Trend:</span>
              <span 
                data-testid="trend-score"
                className="font-mono text-chart-3"
              >
                {confidence.trendScore > 0 ? '+' : ''}{(confidence.trendScore || 0).toFixed(2)}
              </span>
            </div>
            <div className="flex justify-between">
              <span>Volatility:</span>
              <span 
                data-testid="volatility-score"
                className="font-mono text-chart-4"
              >
                {confidence.volatilityScore > 0 ? '+' : ''}{(confidence.volatilityScore || 0).toFixed(2)}
              </span>
            </div>
          </div>
        </div>
      </div>
    </Card>
  );
}
