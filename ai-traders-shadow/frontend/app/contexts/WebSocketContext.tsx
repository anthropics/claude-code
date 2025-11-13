'use client';

import React, { createContext, useContext, useEffect, useState, useRef, ReactNode } from 'react';
import { MoodData, PredictionData, PortfolioData, WebSocketMessage } from '../types';

export type StrategyType = 'PPO' | 'GAIL';

interface WebSocketContextType {
  // Connection state
  isConnected: boolean;
  connectionStatus: 'connecting' | 'connected' | 'disconnected' | 'error';

  // Real-time data
  currentMood: MoodData | null;
  currentPrediction: PredictionData | null;
  currentPortfolio: PortfolioData | null;

  // Strategy state
  selectedStrategy: StrategyType;
  setSelectedStrategy: (strategy: StrategyType) => void;

  // Methods
  sendMessage: (message: any) => void;
  reconnect: () => void;
}

const WebSocketContext = createContext<WebSocketContextType | undefined>(undefined);

export const useWebSocket = () => {
  const context = useContext(WebSocketContext);
  if (!context) {
    throw new Error('useWebSocket must be used within WebSocketProvider');
  }
  return context;
};

interface WebSocketProviderProps {
  children: ReactNode;
  userId?: number;
}

export const WebSocketProvider: React.FC<WebSocketProviderProps> = ({
  children,
  userId = 1, // Default user ID
}) => {
  const [isConnected, setIsConnected] = useState(false);
  const [connectionStatus, setConnectionStatus] = useState<'connecting' | 'connected' | 'disconnected' | 'error'>('connecting');

  const [currentMood, setCurrentMood] = useState<MoodData | null>(null);
  const [currentPrediction, setCurrentPrediction] = useState<PredictionData | null>(null);
  const [currentPortfolio, setCurrentPortfolio] = useState<PortfolioData | null>(null);

  // Strategy state (default: PPO for free tier)
  const [selectedStrategy, setSelectedStrategy] = useState<StrategyType>('PPO');

  const wsRef = useRef<WebSocket | null>(null);
  const reconnectTimeoutRef = useRef<NodeJS.Timeout>();
  const reconnectAttemptsRef = useRef(0);

  const WS_URL = process.env.NEXT_PUBLIC_WS_URL || 'ws://localhost:8000';

  const connect = () => {
    try {
      setConnectionStatus('connecting');
      console.log(`[WebSocket] Connecting to ${WS_URL}/ws/${userId}...`);

      const ws = new WebSocket(`${WS_URL}/ws/${userId}`);
      wsRef.current = ws;

      ws.onopen = () => {
        console.log('[WebSocket] Connected successfully');
        setIsConnected(true);
        setConnectionStatus('connected');
        reconnectAttemptsRef.current = 0;

        // Send initial ping to verify connection
        sendMessage({ type: 'ping', timestamp: new Date().toISOString() });
      };

      ws.onmessage = (event) => {
        try {
          const message: WebSocketMessage = JSON.parse(event.data);
          console.log('[WebSocket] Message received:', message.type);

          handleMessage(message);
        } catch (error) {
          console.error('[WebSocket] Error parsing message:', error);
        }
      };

      ws.onerror = (error) => {
        console.error('[WebSocket] Error:', error);
        setConnectionStatus('error');
      };

      ws.onclose = () => {
        console.log('[WebSocket] Connection closed');
        setIsConnected(false);
        setConnectionStatus('disconnected');
        wsRef.current = null;

        // Attempt to reconnect with exponential backoff
        attemptReconnect();
      };
    } catch (error) {
      console.error('[WebSocket] Connection error:', error);
      setConnectionStatus('error');
      attemptReconnect();
    }
  };

  const attemptReconnect = () => {
    if (reconnectAttemptsRef.current < 10) {
      const delay = Math.min(1000 * Math.pow(2, reconnectAttemptsRef.current), 30000);
      console.log(`[WebSocket] Reconnecting in ${delay}ms (attempt ${reconnectAttemptsRef.current + 1}/10)...`);

      reconnectTimeoutRef.current = setTimeout(() => {
        reconnectAttemptsRef.current++;
        connect();
      }, delay);
    } else {
      console.error('[WebSocket] Max reconnection attempts reached');
      setConnectionStatus('error');
    }
  };

  const handleMessage = (message: WebSocketMessage) => {
    switch (message.type) {
      case 'mood_update':
        console.log('[WebSocket] Mood update received:', message.data);
        setCurrentMood(message.data as MoodData);
        break;

      case 'prediction_update':
        console.log('[WebSocket] Prediction update received:', message.data);
        setCurrentPrediction(message.data as PredictionData);
        break;

      case 'pnl_update':
        console.log('[WebSocket] P&L update received:', message.data);
        // Update portfolio data
        if (currentPortfolio) {
          setCurrentPortfolio({
            ...currentPortfolio,
            total_pnl: message.data.pnl,
            current_balance: message.data.balance,
          });
        }
        break;

      case 'trade_execution':
        console.log('[WebSocket] Trade execution received:', message.data);
        // Could trigger a notification here
        break;

      case 'agent_status':
        console.log('[WebSocket] Agent status received:', message.data);
        // Handle agent status updates
        break;

      default:
        console.log('[WebSocket] Unknown message type:', message.type);
    }
  };

  const sendMessage = (message: any) => {
    if (wsRef.current && wsRef.current.readyState === WebSocket.OPEN) {
      wsRef.current.send(JSON.stringify(message));
      console.log('[WebSocket] Message sent:', message.type || 'unknown');
    } else {
      console.warn('[WebSocket] Cannot send message - not connected');
    }
  };

  const reconnect = () => {
    console.log('[WebSocket] Manual reconnect triggered');
    if (wsRef.current) {
      wsRef.current.close();
    }
    reconnectAttemptsRef.current = 0;
    connect();
  };

  // Initialize connection
  useEffect(() => {
    connect();

    // Cleanup on unmount
    return () => {
      if (reconnectTimeoutRef.current) {
        clearTimeout(reconnectTimeoutRef.current);
      }
      if (wsRef.current) {
        wsRef.current.close();
      }
    };
  }, [userId]);

  // Heartbeat to keep connection alive
  useEffect(() => {
    if (!isConnected) return;

    const heartbeat = setInterval(() => {
      sendMessage({ type: 'ping', timestamp: new Date().toISOString() });
    }, 30000); // Every 30 seconds

    return () => clearInterval(heartbeat);
  }, [isConnected]);

  const value: WebSocketContextType = {
    isConnected,
    connectionStatus,
    currentMood,
    currentPrediction,
    currentPortfolio,
    selectedStrategy,
    setSelectedStrategy,
    sendMessage,
    reconnect,
  };

  return (
    <WebSocketContext.Provider value={value}>
      {children}
    </WebSocketContext.Provider>
  );
};
