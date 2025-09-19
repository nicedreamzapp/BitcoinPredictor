import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { apiRequest } from '@/lib/queryClient';
import { useToast } from '@/hooks/use-toast';
import { useWebSocket } from './use-websocket';
import type { 
  LivePriceUpdate, 
  ConfidenceScore, 
  TradingSignal, 
  Trade, 
  RiskMetrics 
} from '@shared/schema';

interface StrategyStatus {
  active: boolean;
  weights: {
    momentum: number;
    volume: number;
    trend: number;
    volatility: number;
  };
}

interface PerformanceData {
  totalPnL: number;
  winRate: number;
  totalTrades: number;
  maxDrawdown: number;
  avgWin: number;
  avgLoss: number;
}

export function useTradingData() {
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const { priceUpdate, confidenceUpdate, riskMetrics: wsRiskMetrics } = useWebSocket();

  // Current market data
  const { data: marketData } = useQuery({
    queryKey: ['/api/market/current'],
    queryFn: () => apiRequest('GET', '/api/market/current').then(r => r.json()),
    refetchInterval: 10000,
  });

  // Strategy status
  const { data: strategyStatus } = useQuery({
    queryKey: ['/api/strategy/status'],
    queryFn: () => apiRequest('GET', '/api/strategy/status').then(r => r.json()),
    refetchInterval: 5000,
  });

  // Recent signals
  const { data: recentSignals } = useQuery({
    queryKey: ['/api/signals'],
    queryFn: () => apiRequest('GET', '/api/signals').then(r => r.json()),
    refetchInterval: 5000,
  });

  // Active trades
  const { data: activeTrades } = useQuery({
    queryKey: ['/api/trades', 'active'],
    queryFn: () => apiRequest('GET', '/api/trades?active=true').then(r => r.json()),
    refetchInterval: 3000,
  });

  // Recent trades
  const { data: recentTrades } = useQuery({
    queryKey: ['/api/trades'],
    queryFn: () => apiRequest('GET', '/api/trades').then(r => r.json()),
    refetchInterval: 5000,
  });

  // Performance analytics
  const { data: performanceData } = useQuery({
    queryKey: ['/api/analytics/performance'],
    queryFn: () => apiRequest('GET', '/api/analytics/performance').then(r => r.json()),
    refetchInterval: 10000,
  });

  // Backtest results
  const { data: backtestResults } = useQuery({
    queryKey: ['/api/backtest/results'],
    queryFn: () => apiRequest('GET', '/api/backtest/results').then(r => r.json()),
    refetchInterval: 30000,
  });

  // Emergency stop mutation
  const emergencyStopMutation = useMutation({
    mutationFn: async () => {
      const response = await apiRequest('POST', '/api/emergency-stop', {});
      return response.json();
    },
    onSuccess: () => {
      toast({
        title: "Emergency Stop Executed",
        description: "All positions have been closed and trading has been halted.",
        variant: "destructive",
      });
      queryClient.invalidateQueries({ queryKey: ['/api/trades'] });
      queryClient.invalidateQueries({ queryKey: ['/api/signals'] });
      queryClient.invalidateQueries({ queryKey: ['/api/strategy/status'] });
    },
    onError: () => {
      toast({
        title: "Emergency Stop Failed",
        description: "Failed to execute emergency stop. Please try again.",
        variant: "destructive",
      });
    },
  });

  // Toggle strategy mutation
  const toggleStrategyMutation = useMutation({
    mutationFn: async (active: boolean) => {
      const response = await apiRequest('POST', '/api/strategy/toggle', { active });
      return response.json();
    },
    onSuccess: (data) => {
      toast({
        title: data.active ? "Strategy Activated" : "Strategy Paused",
        description: data.active 
          ? "Trading strategy is now active and monitoring markets."
          : "Trading strategy has been paused.",
      });
      queryClient.invalidateQueries({ queryKey: ['/api/strategy/status'] });
    },
    onError: () => {
      toast({
        title: "Strategy Toggle Failed",
        description: "Failed to toggle strategy status. Please try again.",
        variant: "destructive",
      });
    },
  });

  // Update strategy weights mutation
  const updateWeightsMutation = useMutation({
    mutationFn: async (weights: Partial<StrategyStatus['weights']>) => {
      const response = await apiRequest('POST', '/api/strategy/weights', weights);
      return response.json();
    },
    onSuccess: () => {
      toast({
        title: "Strategy Weights Updated",
        description: "ML model weights have been successfully updated.",
      });
      queryClient.invalidateQueries({ queryKey: ['/api/strategy/status'] });
    },
    onError: () => {
      toast({
        title: "Update Failed",
        description: "Failed to update strategy weights. Please try again.",
        variant: "destructive",
      });
    },
  });

  // Create manual signal mutation
  const createSignalMutation = useMutation({
    mutationFn: async (signalData: any) => {
      const response = await apiRequest('POST', '/api/signals', signalData);
      return response.json();
    },
    onSuccess: () => {
      toast({
        title: "Signal Created",
        description: "Manual trading signal has been created successfully.",
      });
      queryClient.invalidateQueries({ queryKey: ['/api/signals'] });
    },
    onError: () => {
      toast({
        title: "Signal Creation Failed",
        description: "Failed to create trading signal. Please try again.",
        variant: "destructive",
      });
    },
  });

  // Update trade mutation
  const updateTradeMutation = useMutation({
    mutationFn: async ({ tradeId, updates }: { tradeId: string; updates: any }) => {
      const response = await apiRequest('PATCH', `/api/trades/${tradeId}`, updates);
      return response.json();
    },
    onSuccess: () => {
      toast({
        title: "Trade Updated",
        description: "Trade has been updated successfully.",
      });
      queryClient.invalidateQueries({ queryKey: ['/api/trades'] });
    },
    onError: () => {
      toast({
        title: "Trade Update Failed",
        description: "Failed to update trade. Please try again.",
        variant: "destructive",
      });
    },
  });

  // Run backtest mutation
  const runBacktestMutation = useMutation({
    mutationFn: async (backtestConfig: any) => {
      const response = await apiRequest('POST', '/api/backtest', backtestConfig);
      return response.json();
    },
    onSuccess: () => {
      toast({
        title: "Backtest Completed",
        description: "Strategy backtest has completed successfully.",
      });
      queryClient.invalidateQueries({ queryKey: ['/api/backtest/results'] });
    },
    onError: () => {
      toast({
        title: "Backtest Failed",
        description: "Failed to run backtest. Please try again.",
        variant: "destructive",
      });
    },
  });

  // Use WebSocket data if available, fallback to API data
  const currentPrice: LivePriceUpdate | undefined = priceUpdate || (marketData as any)?.price;
  const confidence: ConfidenceScore | undefined = confidenceUpdate || (marketData as any)?.confidence;
  const riskMetrics: RiskMetrics | undefined = wsRiskMetrics || (marketData as any)?.riskMetrics;

  return {
    // Data
    currentPrice,
    confidence,
    riskMetrics,
    recentSignals: recentSignals || [],
    activeTrades: activeTrades || [],
    recentTrades: recentTrades || [],
    performanceData: performanceData as PerformanceData,
    backtestResults: backtestResults || [],
    strategyStatus: strategyStatus as StrategyStatus,

    // Actions
    emergencyStop: emergencyStopMutation.mutateAsync,
    toggleStrategy: (active: boolean) => toggleStrategyMutation.mutate(active),
    updateWeights: (weights: Partial<StrategyStatus['weights']>) => updateWeightsMutation.mutate(weights),
    createSignal: (signalData: any) => createSignalMutation.mutate(signalData),
    updateTrade: (tradeId: string, updates: any) => updateTradeMutation.mutate({ tradeId, updates }),
    runBacktest: (config: any) => runBacktestMutation.mutate(config),

    // Loading states
    isEmergencyStopLoading: emergencyStopMutation.isPending,
    isToggleStrategyLoading: toggleStrategyMutation.isPending,
    isUpdateWeightsLoading: updateWeightsMutation.isPending,
    isCreateSignalLoading: createSignalMutation.isPending,
    isUpdateTradeLoading: updateTradeMutation.isPending,
    isRunBacktestLoading: runBacktestMutation.isPending,
  };
}
