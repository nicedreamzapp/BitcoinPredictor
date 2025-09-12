import { useEffect } from "react";
import { useWebSocket } from "@/hooks/use-websocket";
import { useTradingData } from "@/hooks/use-trading-data";
import TradingSidebar from "@/components/trading/trading-sidebar";
import PriceHeader from "@/components/trading/price-header";
import TradingChart from "@/components/trading/trading-chart";
import ConfidenceEngine from "@/components/trading/confidence-engine";
import TechnicalIndicators from "@/components/trading/technical-indicators";
import PerformanceAnalytics from "@/components/trading/performance-analytics";
import RiskManagementPanel from "@/components/trading/risk-management-panel";
import { Button } from "@/components/ui/button";
import { Settings, Bell, Bitcoin } from "lucide-react";

export default function TradingDashboard() {
  const { connectionStatus, lastMessage } = useWebSocket();
  const { 
    currentPrice, 
    confidence, 
    riskMetrics, 
    recentSignals, 
    activeTrades,
    emergencyStop,
    toggleStrategy,
    strategyStatus
  } = useTradingData();

  useEffect(() => {
    document.title = "BitTrader Pro - Advanced Bitcoin Trading Platform";
  }, []);

  const handleEmergencyStop = async () => {
    if (confirm("Are you sure you want to execute an emergency stop? This will close all positions and halt trading.")) {
      await emergencyStop();
    }
  };

  const getConnectionStatusColor = () => {
    switch (connectionStatus) {
      case 'connected': return 'websocket-connected';
      case 'connecting': return 'websocket-connecting';
      case 'disconnected': return 'websocket-disconnected';
      default: return 'websocket-disconnected';
    }
  };

  const getConnectionStatusText = () => {
    switch (connectionStatus) {
      case 'connected': return 'Market Open';
      case 'connecting': return 'Connecting';
      case 'disconnected': return 'Disconnected';
      default: return 'Unknown';
    }
  };

  return (
    <div className="trading-grid">
      {/* Header */}
      <header className="col-span-3 bg-card border-b border-border px-6 py-3 flex items-center justify-between">
        <div className="flex items-center space-x-4">
          <div className="flex items-center space-x-2">
            <Bitcoin className="h-6 w-6 text-yellow-500" />
            <h1 className="text-xl font-bold">BitTrader Pro</h1>
          </div>
          <div className="text-sm text-muted-foreground">
            Real-time Bitcoin Trading Platform
          </div>
        </div>
        
        <div className="flex items-center space-x-6">
          <div className="flex items-center space-x-4 text-sm">
            <div className="flex items-center space-x-1">
              <div className={`websocket-indicator ${getConnectionStatusColor()}`}></div>
              <span data-testid="connection-status">{getConnectionStatusText()}</span>
            </div>
            <div className="text-muted-foreground">
              Last Update: <span data-testid="last-update">{new Date().toLocaleTimeString()}</span>
            </div>
          </div>
          
          <div className="flex items-center space-x-3">
            <Button 
              variant="ghost" 
              size="sm" 
              data-testid="button-settings"
              className="p-2 hover:bg-muted rounded-lg transition-colors"
            >
              <Settings className="h-4 w-4" />
            </Button>
            <Button 
              variant="ghost" 
              size="sm"
              data-testid="button-notifications"
              className="p-2 hover:bg-muted rounded-lg transition-colors"
            >
              <Bell className="h-4 w-4" />
            </Button>
            <div className="w-8 h-8 bg-primary rounded-full flex items-center justify-center text-primary-foreground text-sm font-semibold">
              JP
            </div>
          </div>
        </div>
      </header>

      {/* Left Sidebar - Controls & Signals */}
      <TradingSidebar 
        confidence={confidence}
        activeTrades={activeTrades}
        recentSignals={recentSignals}
        strategyStatus={strategyStatus}
        onEmergencyStop={handleEmergencyStop}
        onToggleStrategy={toggleStrategy}
      />

      {/* Main Content - Charts and Analysis */}
      <main className="bg-background overflow-y-auto">
        <div className="p-6 space-y-6">
          {/* Price Header */}
          <PriceHeader currentPrice={currentPrice} />
          
          {/* Trading Chart */}
          <TradingChart />
          
          {/* Confidence Engine & Technical Indicators */}
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            <ConfidenceEngine confidence={confidence} />
            <TechnicalIndicators />
          </div>
          
          {/* Performance Analytics */}
          <PerformanceAnalytics riskMetrics={riskMetrics} />
        </div>
      </main>

      {/* Right Sidebar - Risk Management & Backtesting */}
      <RiskManagementPanel />
    </div>
  );
}
