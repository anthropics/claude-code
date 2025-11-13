'use client';

import React, { useEffect, useState } from 'react';
import { useWebSocket } from '../contexts/WebSocketContext';
import { ActionType } from '../types';
import axios from 'axios';

const ACTION_CONFIG = {
  HOLD: {
    emoji: '⏸️',
    label: 'Hold',
    color: 'bg-gray-100',
    textColor: 'text-gray-700',
    borderColor: 'border-gray-300',
    description: 'Wait for better conditions',
  },
  BUY: {
    emoji: '🟢',
    label: 'Buy',
    color: 'bg-green-100',
    textColor: 'text-green-700',
    borderColor: 'border-green-300',
    description: 'Buying opportunity identified',
  },
  SELL: {
    emoji: '🔴',
    label: 'Sell',
    color: 'bg-red-100',
    textColor: 'text-red-700',
    borderColor: 'border-red-300',
    description: 'Consider taking profit',
  },
};

interface Props {
  symbol?: string;
}

export const AiRecommendation: React.FC<Props> = ({ symbol = 'BTC-USDT' }) => {
  const { currentPrediction, isConnected, selectedStrategy } = useWebSocket();
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const apiUrl = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:8000';

  // Fetch initial prediction
  const fetchPrediction = async () => {
    setLoading(true);
    setError(null);

    try {
      // Add strategy parameter to API call
      const response = await axios.get(
        `${apiUrl}/api/v1/prediction/predict/${symbol}?strategy=${selectedStrategy}&include_explanation=true`
      );
      console.log('[AiRecommendation] Prediction fetched:', response.data);
    } catch (err: any) {
      console.error('[AiRecommendation] Error fetching prediction:', err);
      setError(err.response?.data?.detail || 'Failed to fetch prediction');
    } finally {
      setLoading(false);
    }
  };

  // Fetch prediction on mount and periodically
  // Also re-fetch when strategy changes
  useEffect(() => {
    fetchPrediction();

    // Refresh every 60 seconds
    const interval = setInterval(fetchPrediction, 60000);
    return () => clearInterval(interval);
  }, [symbol, selectedStrategy]);

  if (loading && !currentPrediction) {
    return (
      <div className="bg-white rounded-xl shadow-lg p-6 border-2 border-gray-200">
        <h3 className="text-xl font-bold text-gray-800 mb-4">
          🧠 AI Recommendation
        </h3>
        <div className="flex items-center justify-center py-8">
          <div className="animate-pulse text-4xl">🤖</div>
          <span className="ml-4 text-gray-500">Analyzing...</span>
        </div>
      </div>
    );
  }

  if (error || !currentPrediction) {
    return (
      <div className="bg-white rounded-xl shadow-lg p-6 border-2 border-gray-200">
        <h3 className="text-xl font-bold text-gray-800 mb-4">
          🧠 AI Recommendation
        </h3>
        <div className="bg-yellow-50 border border-yellow-200 rounded-lg p-4">
          <p className="text-sm text-yellow-800">
            {error || 'Model not loaded. Train model: python -m app.ml.train_ppo'}
          </p>
          <button
            onClick={fetchPrediction}
            className="mt-3 text-sm text-blue-600 hover:text-blue-800 font-medium"
          >
            Try Again
          </button>
        </div>
      </div>
    );
  }

  const action = currentPrediction.action_name;
  const config = ACTION_CONFIG[action];

  return (
    <div className={`bg-white rounded-xl shadow-lg p-6 border-2 ${config.borderColor}`}>
      {/* Header */}
      <div className="flex items-center justify-between mb-4">
        <h3 className="text-xl font-bold text-gray-800">
          🧠 AI Recommendation
        </h3>
        <div className="text-xs text-gray-500 bg-gray-100 px-2 py-1 rounded">
          {selectedStrategy === 'PPO' ? '🤖 Layer 2: PPO' : '🧠 Layer 3: GAIL'}
        </div>
      </div>

      {/* Action Display */}
      <div className={`${config.color} rounded-lg p-6 mb-4`}>
        <div className="flex items-center justify-between">
          <div className="flex items-center space-x-4">
            <div className="text-5xl">{config.emoji}</div>
            <div>
              <div className={`text-3xl font-bold ${config.textColor}`}>
                {config.label}
              </div>
              <div className="text-sm text-gray-600 mt-1">
                {config.description}
              </div>
            </div>
          </div>

          {/* Price */}
          {currentPrediction.current_price && (
            <div className="text-right">
              <div className="text-xs text-gray-500 uppercase">Price</div>
              <div className="text-2xl font-bold text-gray-800">
                ${currentPrediction.current_price.toFixed(2)}
              </div>
            </div>
          )}
        </div>
      </div>

      {/* Metadata */}
      <div className="grid grid-cols-2 gap-4 mb-4">
        <div className="bg-gray-50 rounded-lg p-3">
          <div className="text-xs text-gray-500 uppercase tracking-wide">Symbol</div>
          <div className="text-sm font-bold text-gray-800">
            {currentPrediction.symbol}
          </div>
        </div>

        <div className="bg-gray-50 rounded-lg p-3">
          <div className="text-xs text-gray-500 uppercase tracking-wide">Model</div>
          <div className="text-sm font-bold text-gray-800">
            {currentPrediction.model_version}
          </div>
        </div>
      </div>

      {/* Disclaimer */}
      <div className="bg-yellow-50 border border-yellow-200 rounded-lg p-3">
        <p className="text-xs text-yellow-800">
          ⚠️ <strong>Educational Only:</strong> This is AI guidance for PAPER TRADING. Always verify with your own analysis.
        </p>
      </div>

      {/* Timestamp */}
      <div className="mt-3 text-center text-xs text-gray-400">
        Updated: {new Date(currentPrediction.timestamp).toLocaleTimeString()}
      </div>
    </div>
  );
};
