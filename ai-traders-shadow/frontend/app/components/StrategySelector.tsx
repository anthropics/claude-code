'use client';

import React from 'react';

export type StrategyType = 'PPO' | 'GAIL';

interface StrategyOption {
  value: StrategyType;
  label: string;
  description: string;
  emoji: string;
  isPremium: boolean;
  disabled: boolean;
}

const STRATEGY_OPTIONS: StrategyOption[] = [
  {
    value: 'PPO',
    label: 'L2: Standard AI (PPO)',
    description: 'Baseline Reinforcement Learning model',
    emoji: '🤖',
    isPremium: false,
    disabled: false,
  },
  {
    value: 'GAIL',
    label: 'L3: Expert AI (GAIL)',
    description: 'Learns from expert trader demonstrations',
    emoji: '🧠',
    isPremium: true,
    disabled: true, // Mock-up: Premium feature locked for MVP
  },
];

interface Props {
  selectedStrategy: StrategyType;
  onStrategyChange: (strategy: StrategyType) => void;
  className?: string;
}

export const StrategySelector: React.FC<Props> = ({
  selectedStrategy,
  onStrategyChange,
  className = '',
}) => {
  return (
    <div className={`bg-white rounded-xl shadow-lg p-6 border-2 border-gray-200 ${className}`}>
      {/* Header */}
      <div className="flex items-center justify-between mb-4">
        <h3 className="text-xl font-bold text-gray-800">
          🎯 AI Strategy
        </h3>
        <div className="text-xs text-gray-500 bg-gray-100 px-2 py-1 rounded">
          Three-Layer System
        </div>
      </div>

      {/* Strategy Selector Dropdown */}
      <div className="mb-4">
        <label className="block text-sm font-medium text-gray-700 mb-2">
          Select AI Model
        </label>
        <div className="relative">
          <select
            value={selectedStrategy}
            onChange={(e) => onStrategyChange(e.target.value as StrategyType)}
            className="w-full px-4 py-3 pr-10 border-2 border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent appearance-none bg-white text-gray-800 font-medium cursor-pointer"
          >
            {STRATEGY_OPTIONS.map((option) => (
              <option
                key={option.value}
                value={option.value}
                disabled={option.disabled}
              >
                {option.emoji} {option.label}
                {option.isPremium ? ' 🔒 [Premium]' : ''}
              </option>
            ))}
          </select>
          <div className="absolute inset-y-0 right-0 flex items-center pr-3 pointer-events-none">
            <svg
              className="w-5 h-5 text-gray-400"
              fill="none"
              stroke="currentColor"
              viewBox="0 0 24 24"
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth={2}
                d="M19 9l-7 7-7-7"
              />
            </svg>
          </div>
        </div>
      </div>

      {/* Strategy Cards */}
      <div className="space-y-3">
        {STRATEGY_OPTIONS.map((option) => {
          const isSelected = selectedStrategy === option.value;
          const isLocked = option.disabled;

          return (
            <div
              key={option.value}
              onClick={() => !isLocked && onStrategyChange(option.value)}
              className={`
                relative rounded-lg p-4 border-2 transition-all cursor-pointer
                ${isSelected
                  ? 'border-blue-500 bg-blue-50'
                  : 'border-gray-200 bg-gray-50'
                }
                ${isLocked
                  ? 'opacity-60 cursor-not-allowed'
                  : 'hover:border-blue-300 hover:bg-blue-50'
                }
              `}
            >
              {/* Lock Icon for Premium */}
              {isLocked && (
                <div className="absolute top-2 right-2 text-2xl">
                  🔒
                </div>
              )}

              <div className="flex items-start space-x-3">
                <div className="text-3xl mt-1">{option.emoji}</div>
                <div className="flex-1">
                  <div className="flex items-center space-x-2">
                    <div className={`font-bold ${isSelected ? 'text-blue-700' : 'text-gray-800'}`}>
                      {option.label}
                    </div>
                    {option.isPremium && (
                      <span className="text-xs bg-yellow-100 text-yellow-800 px-2 py-0.5 rounded-full font-semibold">
                        PREMIUM
                      </span>
                    )}
                  </div>
                  <div className="text-sm text-gray-600 mt-1">
                    {option.description}
                  </div>

                  {/* Premium Notice */}
                  {isLocked && (
                    <div className="mt-2 text-xs text-yellow-700 bg-yellow-50 border border-yellow-200 rounded px-2 py-1">
                      💎 Upgrade to Premium to unlock Expert AI trained on profitable trades
                    </div>
                  )}
                </div>
              </div>

              {/* Selected Indicator */}
              {isSelected && !isLocked && (
                <div className="absolute top-2 right-2">
                  <div className="w-6 h-6 bg-blue-500 rounded-full flex items-center justify-center">
                    <svg className="w-4 h-4 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={3} d="M5 13l4 4L19 7" />
                    </svg>
                  </div>
                </div>
              )}
            </div>
          );
        })}
      </div>

      {/* Info Box */}
      <div className="mt-4 bg-blue-50 border border-blue-200 rounded-lg p-3">
        <p className="text-xs text-blue-800">
          <strong>ℹ️ How it works:</strong> Our three-layer system combines heuristic checks (L1),
          reinforcement learning (L2 PPO), and expert imitation (L3 GAIL) for optimal trading decisions.
        </p>
      </div>

      {/* Current Selection Display */}
      <div className="mt-4 pt-4 border-t border-gray-200">
        <div className="flex items-center justify-between text-sm">
          <span className="text-gray-600">Active Strategy:</span>
          <span className="font-bold text-gray-800">
            {STRATEGY_OPTIONS.find(o => o.value === selectedStrategy)?.emoji}{' '}
            {selectedStrategy}
          </span>
        </div>
      </div>
    </div>
  );
};
