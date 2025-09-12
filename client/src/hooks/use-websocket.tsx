import { useState, useEffect, useRef, useCallback } from 'react';
import type { LivePriceUpdate, ConfidenceScore, TradingSignal, Trade, RiskMetrics } from '@shared/schema';

export type WebSocketMessage = {
  type: 'price_update' | 'confidence_update' | 'new_signal' | 'new_trade' | 'risk_metrics' | 'emergency_stop';
  data: any;
};

export type ConnectionStatus = 'connecting' | 'connected' | 'disconnected' | 'error';

interface UseWebSocketReturn {
  connectionStatus: ConnectionStatus;
  lastMessage: WebSocketMessage | null;
  sendMessage: (message: any) => void;
  priceUpdate: LivePriceUpdate | null;
  confidenceUpdate: ConfidenceScore | null;
  newSignal: TradingSignal | null;
  newTrade: Trade | null;
  riskMetrics: RiskMetrics | null;
}

export function useWebSocket(): UseWebSocketReturn {
  const [connectionStatus, setConnectionStatus] = useState<ConnectionStatus>('disconnected');
  const [lastMessage, setLastMessage] = useState<WebSocketMessage | null>(null);
  const [priceUpdate, setPriceUpdate] = useState<LivePriceUpdate | null>(null);
  const [confidenceUpdate, setConfidenceUpdate] = useState<ConfidenceScore | null>(null);
  const [newSignal, setNewSignal] = useState<TradingSignal | null>(null);
  const [newTrade, setNewTrade] = useState<Trade | null>(null);
  const [riskMetrics, setRiskMetrics] = useState<RiskMetrics | null>(null);

  const ws = useRef<WebSocket | null>(null);
  const reconnectTimeoutRef = useRef<NodeJS.Timeout | null>(null);
  const reconnectAttempts = useRef(0);
  const maxReconnectAttempts = 5;

  const connect = useCallback(() => {
    try {
      setConnectionStatus('connecting');
      
      const protocol = window.location.protocol === "https:" ? "wss:" : "ws:";
      const wsUrl = `${protocol}//${window.location.host}/ws`;
      
      ws.current = new WebSocket(wsUrl);

      ws.current.onopen = () => {
        console.log('WebSocket connected');
        setConnectionStatus('connected');
        reconnectAttempts.current = 0;
      };

      ws.current.onmessage = (event) => {
        try {
          const message: WebSocketMessage = JSON.parse(event.data);
          setLastMessage(message);

          // Handle specific message types
          switch (message.type) {
            case 'price_update':
              setPriceUpdate(message.data);
              break;
            case 'confidence_update':
              setConfidenceUpdate(message.data);
              break;
            case 'new_signal':
              setNewSignal(message.data);
              break;
            case 'new_trade':
              setNewTrade(message.data);
              break;
            case 'risk_metrics':
              setRiskMetrics(message.data);
              break;
            case 'emergency_stop':
              console.log('Emergency stop executed');
              break;
          }
        } catch (error) {
          console.error('Error parsing WebSocket message:', error);
        }
      };

      ws.current.onclose = () => {
        console.log('WebSocket disconnected');
        setConnectionStatus('disconnected');
        
        // Attempt to reconnect if not manually closed
        if (reconnectAttempts.current < maxReconnectAttempts) {
          const delay = Math.min(1000 * Math.pow(2, reconnectAttempts.current), 30000);
          reconnectTimeoutRef.current = setTimeout(() => {
            reconnectAttempts.current++;
            connect();
          }, delay);
        }
      };

      ws.current.onerror = (error) => {
        console.error('WebSocket error:', error);
        setConnectionStatus('error');
      };

    } catch (error) {
      console.error('Failed to connect WebSocket:', error);
      setConnectionStatus('error');
    }
  }, []);

  const disconnect = useCallback(() => {
    if (reconnectTimeoutRef.current) {
      clearTimeout(reconnectTimeoutRef.current);
      reconnectTimeoutRef.current = null;
    }
    
    if (ws.current && ws.current.readyState === WebSocket.OPEN) {
      ws.current.close();
    }
    
    setConnectionStatus('disconnected');
  }, []);

  const sendMessage = useCallback((message: any) => {
    if (ws.current && ws.current.readyState === WebSocket.OPEN) {
      ws.current.send(JSON.stringify(message));
    } else {
      console.warn('WebSocket is not connected');
    }
  }, []);

  useEffect(() => {
    connect();
    
    return () => {
      disconnect();
    };
  }, [connect, disconnect]);

  // Clear individual updates after they've been processed
  useEffect(() => {
    if (newSignal) {
      const timer = setTimeout(() => setNewSignal(null), 5000);
      return () => clearTimeout(timer);
    }
  }, [newSignal]);

  useEffect(() => {
    if (newTrade) {
      const timer = setTimeout(() => setNewTrade(null), 5000);
      return () => clearTimeout(timer);
    }
  }, [newTrade]);

  return {
    connectionStatus,
    lastMessage,
    sendMessage,
    priceUpdate,
    confidenceUpdate,
    newSignal,
    newTrade,
    riskMetrics
  };
}
