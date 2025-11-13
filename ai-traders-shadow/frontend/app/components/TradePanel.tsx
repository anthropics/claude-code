'use client';

import React, { useState } from 'react';
import axios from 'axios';
import { useWebSocket } from '../contexts/WebSocketContext';

interface Props {
  defaultSymbol?: string;
}

export const TradePanel: React.FC<Props> = ({ defaultSymbol = 'BTC-USDT' }) => {
  const { selectedStrategy } = useWebSocket();
  const [symbol, setSymbol] = useState(defaultSymbol);
  const [quantity, setQuantity] = useState('0.001');
  const [loading, setLoading] = useState(false);
  const [message, setMessage] = useState<{ type: 'success' | 'error'; text: string } | null>(null);

  const apiUrl = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:8000';

  const executeTrade = async (side: 'buy' | 'sell') => {
    setLoading(true);
    setMessage(null);

    try {
      const response = await axios.post(`${apiUrl}/api/v1/trading/execute`, {
        symbol,
        side,
        quantity: parseFloat(quantity),
        order_type: 'market',
        strategy: selectedStrategy, // Include strategy for expert collector
      });

      console.log('[TradePanel] Trade executed:', response.data);
      setMessage({
        type: 'success',
        text: `✅ ${side.toUpperCase()} order executed successfully! P&L: $${response.data.pnl?.toFixed(2) || 'N/A'}`,
      });

      // Reset form
      setQuantity('0.001');
    } catch (err: any) {
      console.error('[TradePanel] Trade error:', err);
      setMessage({
        type: 'error',
        text: `❌ ${err.response?.data?.detail || 'Trade execution failed'}`,
      });
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="bg-white rounded-xl shadow-lg p-6 border-2 border-gray-200">
      {/* Header */}
      <div className="flex items-center justify-between mb-4">
        <h3 className="text-xl font-bold text-gray-800">
          📊 Trade Panel
        </h3>
        <div className="text-xs text-gray-500 bg-gray-100 px-2 py-1 rounded">
          Using: {selectedStrategy}
        </div>
      </div>

      <div className="bg-blue-50 border border-blue-200 rounded-lg p-3 mb-4">
        <p className="text-xs text-blue-800">
          💡 <strong>Paper Trading:</strong> All trades are simulated. No real money involved.
        </p>
      </div>

      {/* Form */}
      <div className="space-y-4">
        {/* Symbol Input */}
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">
            Symbol
          </label>
          <input
            type="text"
            value={symbol}
            onChange={(e) => setSymbol(e.target.value)}
            className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
            placeholder="BTC-USDT"
          />
        </div>

        {/* Quantity Input */}
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">
            Quantity (BTC)
          </label>
          <input
            type="number"
            step="0.0001"
            value={quantity}
            onChange={(e) => setQuantity(e.target.value)}
            className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
            placeholder="0.001"
          />
          <p className="text-xs text-gray-500 mt-1">
            Minimum order: $10 USD
          </p>
        </div>

        {/* Action Buttons */}
        <div className="grid grid-cols-2 gap-4">
          <button
            onClick={() => executeTrade('buy')}
            disabled={loading}
            className="bg-green-500 hover:bg-green-600 text-white font-bold py-3 px-6 rounded-lg transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
          >
            {loading ? '⏳ Processing...' : '🟢 Buy'}
          </button>

          <button
            onClick={() => executeTrade('sell')}
            disabled={loading}
            className="bg-red-500 hover:bg-red-600 text-white font-bold py-3 px-6 rounded-lg transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
          >
            {loading ? '⏳ Processing...' : '🔴 Sell'}
          </button>
        </div>

        {/* Message Display */}
        {message && (
          <div
            className={`rounded-lg p-4 ${
              message.type === 'success'
                ? 'bg-green-50 border border-green-200 text-green-800'
                : 'bg-red-50 border border-red-200 text-red-800'
            }`}
          >
            <p className="text-sm">{message.text}</p>
          </div>
        )}
      </div>

      {/* Quick Actions */}
      <div className="mt-6 pt-4 border-t border-gray-200">
        <div className="text-xs text-gray-500 uppercase tracking-wide mb-2">
          Quick Actions
        </div>
        <div className="flex flex-wrap gap-2">
          {['0.001', '0.005', '0.01', '0.05'].map((q) => (
            <button
              key={q}
              onClick={() => setQuantity(q)}
              className="px-3 py-1 bg-gray-100 hover:bg-gray-200 text-gray-700 text-sm rounded-md transition-colors"
            >
              {q} BTC
            </button>
          ))}
        </div>
      </div>
    </div>
  );
};
