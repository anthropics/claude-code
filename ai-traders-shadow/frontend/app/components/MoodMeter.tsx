'use client';

import React, { useEffect, useState } from 'react';
import { useWebSocket } from '../contexts/WebSocketContext';
import { MoodType } from '../types';

const MOOD_CONFIG = {
  confident: {
    emoji: '😎',
    label: 'Confident',
    color: 'mood-confident',
    textColor: 'text-green-700',
    bgColor: 'bg-green-50',
    borderColor: 'border-green-200',
  },
  cautious: {
    emoji: '🤔',
    label: 'Cautious',
    color: 'mood-cautious',
    textColor: 'text-yellow-700',
    bgColor: 'bg-yellow-50',
    borderColor: 'border-yellow-200',
  },
  fatigued: {
    emoji: '😴',
    label: 'Fatigued',
    color: 'mood-fatigued',
    textColor: 'text-orange-700',
    bgColor: 'bg-orange-50',
    borderColor: 'border-orange-200',
  },
  conservative: {
    emoji: '🛡️',
    label: 'Conservative',
    color: 'mood-conservative',
    textColor: 'text-blue-700',
    bgColor: 'bg-blue-50',
    borderColor: 'border-blue-200',
  },
  learning: {
    emoji: '📚',
    label: 'Learning',
    color: 'mood-learning',
    textColor: 'text-purple-700',
    bgColor: 'bg-purple-50',
    borderColor: 'border-purple-200',
  },
};

export const MoodMeter: React.FC = () => {
  const { currentMood, isConnected } = useWebSocket();
  const [isAnimating, setIsAnimating] = useState(false);

  useEffect(() => {
    if (currentMood) {
      setIsAnimating(true);
      const timer = setTimeout(() => setIsAnimating(false), 1000);
      return () => clearTimeout(timer);
    }
  }, [currentMood]);

  if (!currentMood) {
    return (
      <div className="bg-white rounded-xl shadow-lg p-6 border-2 border-gray-200">
        <div className="flex items-center justify-center space-x-4">
          <div className="animate-pulse">
            <div className="text-6xl">🤖</div>
          </div>
          <div>
            <h2 className="text-2xl font-bold text-gray-800">Mood Meter</h2>
            <p className="text-gray-500 mt-1">
              {isConnected ? 'Waiting for data...' : 'Connecting...'}
            </p>
          </div>
        </div>
      </div>
    );
  }

  const mood = currentMood.mood;
  const config = MOOD_CONFIG[mood];
  const moodScore = currentMood.mood_score;

  return (
    <div
      className={`bg-white rounded-xl shadow-lg p-6 border-2 ${config.borderColor} ${
        isAnimating ? 'scale-105' : ''
      } transition-all duration-300`}
    >
      {/* Header */}
      <div className="flex items-center justify-between mb-4">
        <h2 className="text-2xl font-bold text-gray-800">Mood Meter</h2>
        <div className="flex items-center space-x-2">
          <div className={`w-3 h-3 rounded-full ${isConnected ? 'bg-green-500' : 'bg-red-500'} animate-pulse-slow`}></div>
          <span className="text-sm text-gray-500">
            {isConnected ? 'Live' : 'Offline'}
          </span>
        </div>
      </div>

      {/* Mood Display */}
      <div className={`${config.bgColor} rounded-lg p-6 mb-4`}>
        <div className="flex items-center justify-between">
          {/* Emoji & Label */}
          <div className="flex items-center space-x-4">
            <div className="text-6xl animate-pulse-slow">{config.emoji}</div>
            <div>
              <div className={`text-3xl font-bold ${config.textColor}`}>
                {config.label}
              </div>
              <div className="text-sm text-gray-600 mt-1">
                Current AI State
              </div>
            </div>
          </div>

          {/* Mood Score Gauge */}
          <div className="text-right">
            <div className={`text-4xl font-bold ${config.textColor}`}>
              {moodScore.toFixed(0)}
            </div>
            <div className="text-sm text-gray-600">/ 100</div>
          </div>
        </div>

        {/* Progress Bar */}
        <div className="mt-4">
          <div className="w-full bg-gray-200 rounded-full h-3 overflow-hidden">
            <div
              className={`h-full ${config.color} transition-all duration-1000 ease-out`}
              style={{ width: `${moodScore}%` }}
            ></div>
          </div>
        </div>
      </div>

      {/* Metrics Grid */}
      <div className="grid grid-cols-3 gap-4 mb-4">
        <div className="bg-gray-50 rounded-lg p-3">
          <div className="text-xs text-gray-500 uppercase tracking-wide">P&L</div>
          <div className={`text-xl font-bold ${currentMood.recent_pnl >= 0 ? 'text-green-600' : 'text-red-600'}`}>
            ${currentMood.recent_pnl.toFixed(2)}
          </div>
        </div>

        <div className="bg-gray-50 rounded-lg p-3">
          <div className="text-xs text-gray-500 uppercase tracking-wide">Win Rate</div>
          <div className="text-xl font-bold text-gray-800">
            {(currentMood.win_rate * 100).toFixed(1)}%
          </div>
        </div>

        <div className="bg-gray-50 rounded-lg p-3">
          <div className="text-xs text-gray-500 uppercase tracking-wide">Trades (1h)</div>
          <div className="text-xl font-bold text-gray-800">
            {currentMood.trades_count_1h}
          </div>
        </div>
      </div>

      {/* Market Conditions */}
      <div className="grid grid-cols-2 gap-4 mb-4">
        <div className="bg-gray-50 rounded-lg p-3">
          <div className="text-xs text-gray-500 uppercase tracking-wide">Volatility</div>
          <div className="flex items-center justify-between">
            <div className="text-lg font-bold text-gray-800">
              {currentMood.market_volatility.toFixed(0)}
            </div>
            <div className="text-xs text-gray-500">ATR</div>
          </div>
        </div>

        <div className="bg-gray-50 rounded-lg p-3">
          <div className="text-xs text-gray-500 uppercase tracking-wide">Liquidity</div>
          <div className="flex items-center justify-between">
            <div className="text-lg font-bold text-gray-800">
              {currentMood.liquidity_score.toFixed(0)}
            </div>
            <div className="text-xs text-gray-500">/ 100</div>
          </div>
        </div>
      </div>

      {/* Analysis Reason */}
      <div className={`${config.bgColor} rounded-lg p-4 border ${config.borderColor}`}>
        <div className="text-xs text-gray-500 uppercase tracking-wide mb-2">Analysis</div>
        <p className="text-sm text-gray-700 leading-relaxed">
          {currentMood.reason}
        </p>
      </div>

      {/* Timestamp */}
      <div className="mt-4 text-center text-xs text-gray-400">
        Last updated: {new Date(currentMood.timestamp).toLocaleTimeString()}
      </div>
    </div>
  );
};
