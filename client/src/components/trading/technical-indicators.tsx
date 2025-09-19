import { apiRequest } from "@/lib/queryClient";
import { Card } from "@/components/ui/card";
import { useQuery } from "@tanstack/react-query";
import { Activity } from "lucide-react";

export default function TechnicalIndicators() {
  const { data: indicators, isLoading } = useQuery({
    queryKey: ['/api/indicators/latest/BTCUSD'],
    queryFn: () => apiRequest('GET', '/api/indicators/latest/BTCUSD').then(r => r.json()),
    refetchInterval: 5000,
  });

  if (isLoading || !indicators) {
    return (
      <Card className="p-4">
        <h3 className="font-semibold mb-4">Technical Indicators</h3>
        <div className="space-y-3">
          {Array.from({ length: 6 }).map((_, i) => (
            <div key={i} className="flex items-center justify-between">
              <div className="skeleton h-4 w-24 rounded"></div>
              <div className="flex items-center space-x-2">
                <div className="skeleton h-4 w-16 rounded"></div>
                <div className="skeleton h-2 w-2 rounded-full"></div>
              </div>
            </div>
          ))}
        </div>
      </Card>
    );
  }

  // Simulate technical indicator values for demonstration
  const technicalData = {
    stochRSI: { k: 65, d: 58, signal: 'BUY' },
    emaStatus: 'BULLISH',
    volumeProfile: 'HIGH',
    pvsraStatus: 'BULL SPIKE',
    supportResistance: { resistance: 118900, support: 114200 },
    overallSignal: 'STRONG BUY'
  };

  const getIndicatorColor = (signal: string) => {
    switch (signal.toUpperCase()) {
      case 'BUY':
      case 'BULLISH':
      case 'BULL SPIKE':
      case 'STRONG BUY':
        return 'text-green-500';
      case 'SELL':
      case 'BEARISH':
      case 'BEAR SPIKE':
      case 'STRONG SELL':
        return 'text-red-500';
      case 'HIGH':
      case 'NEUTRAL':
        return 'text-yellow-500';
      default:
        return 'text-blue-500';
    }
  };

  const getIndicatorDot = (signal: string) => {
    switch (signal.toUpperCase()) {
      case 'BUY':
      case 'BULLISH':
      case 'BULL SPIKE':
      case 'STRONG BUY':
        return 'bg-green-500';
      case 'SELL':
      case 'BEARISH':
      case 'BEAR SPIKE':
      case 'STRONG SELL':
        return 'bg-red-500';
      case 'HIGH':
      case 'NEUTRAL':
        return 'bg-yellow-500';
      default:
        return 'bg-blue-500';
    }
  };

  return (
    <Card className="p-4">
      <h3 className="font-semibold mb-4">Technical Indicators</h3>
      <div className="space-y-3">
        <div className="flex items-center justify-between">
          <span className="text-sm">StochRSI (14,14,3,3)</span>
          <div className="flex items-center space-x-2">
            <span 
              data-testid="stoch-rsi-value"
              className="font-mono text-sm"
            >
              K:{technicalData.stochRSI.k} D:{technicalData.stochRSI.d}
            </span>
            <div className={`w-2 h-2 rounded-full ${getIndicatorDot(technicalData.stochRSI.signal)}`}></div>
          </div>
        </div>
        
        <div className="flex items-center justify-between">
          <span className="text-sm">EMA Ribbon</span>
          <div className="flex items-center space-x-2">
            <span 
              data-testid="ema-status"
              className={`font-mono text-sm ${getIndicatorColor(technicalData.emaStatus)}`}
            >
              {technicalData.emaStatus}
            </span>
            <div className={`w-2 h-2 rounded-full ${getIndicatorDot(technicalData.emaStatus)}`}></div>
          </div>
        </div>
        
        <div className="flex items-center justify-between">
          <span className="text-sm">Volume Profile</span>
          <div className="flex items-center space-x-2">
            <span 
              data-testid="volume-profile"
              className={`font-mono text-sm ${getIndicatorColor(technicalData.volumeProfile)}`}
            >
              {technicalData.volumeProfile}
            </span>
            <div className={`w-2 h-2 rounded-full ${getIndicatorDot(technicalData.volumeProfile)}`}></div>
          </div>
        </div>
        
        <div className="flex items-center justify-between">
          <span className="text-sm">PVSRA Analysis</span>
          <div className="flex items-center space-x-2">
            <span 
              data-testid="pvsra-status"
              className={`font-mono text-sm ${getIndicatorColor(technicalData.pvsraStatus)}`}
            >
              {technicalData.pvsraStatus}
            </span>
            <div className={`w-2 h-2 rounded-full ${getIndicatorDot(technicalData.pvsraStatus)}`}></div>
          </div>
        </div>
        
        <div className="flex items-center justify-between">
          <span className="text-sm">Support/Resistance</span>
          <div className="flex items-center space-x-2">
            <span 
              data-testid="sr-levels"
              className="font-mono text-sm"
            >
              R: ${technicalData.supportResistance.resistance.toLocaleString()}
            </span>
            <div className="w-2 h-2 bg-blue-500 rounded-full"></div>
          </div>
        </div>

        <div className="pt-2 border-t border-border">
          <div className="flex items-center justify-between">
            <span className="text-sm font-medium">Overall Signal</span>
            <div className="flex items-center space-x-2">
              <span 
                data-testid="overall-signal"
                className={`font-mono text-sm font-bold ${getIndicatorColor(technicalData.overallSignal)}`}
              >
                {technicalData.overallSignal}
              </span>
              <div className={`w-3 h-3 rounded-full market-pulse ${getIndicatorDot(technicalData.overallSignal)}`}></div>
            </div>
          </div>
        </div>
      </div>
    </Card>
  );
}
