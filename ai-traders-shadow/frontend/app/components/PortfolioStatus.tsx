'use client';

import React, { useEffect, useState } from 'react';
import { useWebSocket } from '../contexts/WebSocketContext';
import axios from 'axios';
import { PortfolioData } from '../types';

export const PortfolioStatus: React.FC = () => {
  const { currentPortfolio, isConnected } = useWebSocket();
  const [portfolio, setPortfolio] = useState<PortfolioData | null>(currentPortfolio);
  const [loading, setLoading] = useState(false);

  const apiUrl = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:8000';

  // Fetch portfolio data
  const fetchPortfolio = async () => {
    setLoading(true);
    try {
      const response = await axios.get(`${apiUrl}/api/v1/trading/portfolio`);
      setPortfolio(response.data);
      console.log('[PortfolioStatus] Portfolio data fetched:', response.data);
    } catch (err) {
      console.error('[PortfolioStatus] Error fetching portfolio:', err);
    } finally {
      setLoading(false);
    }
  };

  // Update portfolio from WebSocket or fetch initially
  useEffect(() => {
    if (currentPortfolio) {
      setPortfolio(currentPortfolio);
    } else {
      fetchPortfolio();
    }
  }, [currentPortfolio]);

  // Refresh periodically
  useEffect(() => {
    const interval = setInterval(fetchPortfolio, 30000); // Every 30 seconds
    return () => clearInterval(interval);
  }, []);

  if (loading && !portfolio) {
    return (
      <div className="bg-white rounded-xl shadow-lg p-6 border-2 border-gray-200">
        <h3 className="text-xl font-bold text-gray-800 mb-4">
          💼 Portfolio Status
        </h3>
        <div className="flex items-center justify-center py-8">
          <div className="animate-pulse text-2xl">Loading...</div>
        </div>
      </div>
    );
  }

  const pnl = portfolio?.total_pnl || 0;
  const balance = portfolio?.current_balance || 100;
  const totalTrades = portfolio?.total_trades || 0;
  const winRate = portfolio?.win_rate || 0;

  const pnlPercentage = ((pnl / (balance - pnl)) * 100).toFixed(2);
  const isProfitable = pnl >= 0;

  return (
    <div className="bg-white rounded-xl shadow-lg p-6 border-2 border-gray-200">
      {/* Header */}
      <div className="flex items-center justify-between mb-4">
        <h3 className="text-xl font-bold text-gray-800">
          💼 Portfolio Status
        </h3>
        <div className="flex items-center space-x-2">
          <div className={`w-3 h-3 rounded-full ${isConnected ? 'bg-green-500' : 'bg-gray-400'}`}></div>
          <span className="text-xs text-gray-500">
            {isConnected ? 'Live' : 'Offline'}
          </span>
        </div>
      </div>

      {/* Balance Card */}
      <div className="bg-gradient-to-r from-blue-500 to-blue-600 rounded-lg p-6 text-white mb-4">
        <div className="text-sm opacity-90 mb-1">Paper Trading Balance</div>
        <div className="text-4xl font-bold">
          ${balance.toFixed(2)}
        </div>
        <div className="mt-3 flex items-center space-x-2">
          <div className={`px-3 py-1 rounded-full text-sm font-medium ${
            isProfitable ? 'bg-green-500' : 'bg-red-500'
          }`}>
            {isProfitable ? '📈' : '📉'} {isProfitable ? '+' : ''}{pnlPercentage}%
          </div>
        </div>
      </div>

      {/* P&L Card */}
      <div className={`rounded-lg p-4 mb-4 ${
        isProfitable ? 'bg-green-50 border border-green-200' : 'bg-red-50 border border-red-200'
      }`}>
        <div className="flex items-center justify-between">
          <div>
            <div className="text-sm text-gray-600">Total P&L</div>
            <div className={`text-3xl font-bold ${isProfitable ? 'text-green-700' : 'text-red-700'}`}>
              {isProfitable ? '+' : ''}${pnl.toFixed(2)}
            </div>
          </div>
          <div className="text-5xl">
            {isProfitable ? '💰' : '⚠️'}
          </div>
        </div>
      </div>

      {/* Stats Grid */}
      <div className="grid grid-cols-2 gap-4">
        {/* Total Trades */}
        <div className="bg-gray-50 rounded-lg p-4">
          <div className="flex items-center justify-between">
            <div>
              <div className="text-xs text-gray-500 uppercase tracking-wide">
                Total Trades
              </div>
              <div className="text-2xl font-bold text-gray-800 mt-1">
                {totalTrades}
              </div>
            </div>
            <div className="text-3xl">📊</div>
          </div>
        </div>

        {/* Win Rate */}
        <div className="bg-gray-50 rounded-lg p-4">
          <div className="flex items-center justify-between">
            <div>
              <div className="text-xs text-gray-500 uppercase tracking-wide">
                Win Rate
              </div>
              <div className="text-2xl font-bold text-gray-800 mt-1">
                {(winRate * 100).toFixed(1)}%
              </div>
            </div>
            <div className="text-3xl">
              {winRate >= 0.6 ? '🏆' : winRate >= 0.5 ? '✅' : '📉'}
            </div>
          </div>
        </div>
      </div>

      {/* Performance Indicator */}
      <div className="mt-4 p-4 bg-blue-50 border border-blue-200 rounded-lg">
        <div className="flex items-start space-x-3">
          <div className="text-2xl">💡</div>
          <div className="flex-1">
            <div className="text-sm font-medium text-blue-900 mb-1">
              Performance Tip
            </div>
            <p className="text-xs text-blue-800 leading-relaxed">
              {isProfitable && winRate >= 0.6
                ? "Great job! You're maintaining a strong win rate. Keep following your strategy."
                : winRate >= 0.5
                ? "You're on the right track. Focus on consistency and risk management."
                : "Every trade is a learning opportunity. Review your strategy and adjust accordingly."}
            </p>
          </div>
        </div>
      </div>

      {/* Disclaimer */}
      <div className="mt-4 pt-4 border-t border-gray-200">
        <p className="text-xs text-gray-500 text-center">
          🎓 This is educational paper trading. No real money is involved.
        </p>
      </div>
    </div>
  );
};
