/**
 * TypeScript types for AI Trader's Shadow frontend
 */

export type MoodType = 'confident' | 'cautious' | 'fatigued' | 'conservative' | 'learning';

export type ActionType = 'HOLD' | 'BUY' | 'SELL';

export interface MoodData {
  mood: MoodType;
  mood_score: number;
  recent_pnl: number;
  win_rate: number;
  trades_count_1h: number;
  market_volatility: number;
  liquidity_score: number;
  reason: string;
  timestamp: string;
}

export interface PredictionData {
  action_id: number;
  action_name: ActionType;
  symbol: string;
  current_price: number | null;
  confidence: number | null;
  timestamp: string;
  model_version: string;
}

export interface PortfolioData {
  user_id: number;
  current_balance: number;
  total_pnl: number;
  total_trades: number;
  win_rate: number;
}

export interface TradeData {
  id: number;
  symbol: string;
  side: 'buy' | 'sell';
  price: number;
  quantity: number;
  quote_quantity: number;
  fee: number;
  pnl: number | null;
  status: string;
  executed_at: string;
}

export interface WebSocketMessage {
  type: 'mood_update' | 'pnl_update' | 'trade_execution' | 'market_data' | 'agent_status' | 'prediction_update';
  data: any;
  timestamp: string;
}

export interface TradeRequest {
  symbol: string;
  side: 'buy' | 'sell';
  quantity: number;
  order_type?: string;
}
