import { useState, useEffect, useRef, useCallback } from 'react';
import type { LivePriceUpdate, ConfidenceScore, TradingSignal, Trade, RiskMetrics } from '@shared/schema';

export type WebSocketMessage = {
  type: 'price_update' | 'confidence_update' | 'new_signal' | 'new_trade' | 'risk_metrics' | 'emergency_stop' | 'keepalive';
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
  const reconnectAttempts = useRef(0);
  const maxReconnectAttempts = 5;
  const reconnectTimeout = useRef<NodeJS.Timeout | null>(null);

  const connect = useCallback(() => {
    try {
      if (ws.current?.readyState === WebSocket.OPEN) {
        return;
      }

      setConnectionStatus('connecting');
      
      // Use hardcoded URL for development to avoid undefined port
      const wsUrl = `ws://localhost:3001/ws`;
      
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
          
          // Handle different message types
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
            case 'keepalive':
              // Just keep the connection alive, no action needed
              break;
          }
        } catch (error) {
          console.error('Error parsing WebSocket message:', error);
        }
      };

      ws.current.onclose = (event) => {
        console.log('WebSocket disconnected');
        setConnectionStatus('disconnected');
        
        // Only reconnect if it wasn't a clean close and we haven't exceeded max attempts
        if (event.code !== 1000 && reconnectAttempts.current < maxReconnectAttempts) {
          reconnectAttempts.current += 1;
          const delay = Math.min(1000 * Math.pow(2, reconnectAttempts.current), 30000);
          
          reconnectTimeout.current = setTimeout(() => {
            connect();
          }, delay);
        }
      };

      ws.current.onerror = (error) => {
        console.error('WebSocket error:', error);
        setConnectionStatus('error');
      };
    } catch (error) {
      console.error('Failed to create WebSocket connection:', error);
      setConnectionStatus('error');
    }
  }, []);

  const disconnect = useCallback(() => {
    if (reconnectTimeout.current) {
      clearTimeout(reconnectTimeout.current);
      reconnectTimeout.current = null;
    }
    
    if (ws.current) {
      ws.current.close(1000, 'Component unmounting');
      ws.current = null;
    }
    
    setConnectionStatus('disconnected');
  }, []);

  const sendMessage = useCallback((message: any) => {
    if (ws.current?.readyState === WebSocket.OPEN) {
      ws.current.send(JSON.stringify(message));
    }
  }, []);

  useEffect(() => {
    connect();

    return () => {
      disconnect();
    };
  }, [connect, disconnect]);

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