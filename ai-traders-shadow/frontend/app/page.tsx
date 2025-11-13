'use client';

import React from 'react';
import { MoodMeter } from './components/MoodMeter';
import { AiRecommendation } from './components/AiRecommendation';
import { TradePanel } from './components/TradePanel';
import { PortfolioStatus } from './components/PortfolioStatus';
import { useWebSocket } from './contexts/WebSocketContext';

export default function Home() {
  const { isConnected, connectionStatus, reconnect } = useWebSocket();

  return (
    <div className="min-h-screen bg-gradient-to-br from-gray-50 to-gray-100">
      {/* Header */}
      <header className="bg-white shadow-sm border-b border-gray-200">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center space-x-3">
              <div className="text-3xl">🤖</div>
              <div>
                <h1 className="text-2xl font-bold text-gray-900">
                  AI Trader's Shadow
                </h1>
                <p className="text-sm text-gray-500">
                  Crypto Micro-Mentor - Educational Paper Trading
                </p>
              </div>
            </div>

            {/* Connection Status */}
            <div className="flex items-center space-x-3">
              <div className="flex items-center space-x-2">
                <div className={`w-3 h-3 rounded-full ${
                  isConnected ? 'bg-green-500' : 'bg-red-500'
                } ${isConnected ? 'animate-pulse-slow' : ''}`}></div>
                <span className={`text-sm font-medium ${
                  isConnected ? 'text-green-700' : 'text-red-700'
                }`}>
                  {connectionStatus === 'connected' && 'Connected'}
                  {connectionStatus === 'connecting' && 'Connecting...'}
                  {connectionStatus === 'disconnected' && 'Disconnected'}
                  {connectionStatus === 'error' && 'Connection Error'}
                </span>
              </div>

              {!isConnected && (
                <button
                  onClick={reconnect}
                  className="px-4 py-2 bg-blue-500 hover:bg-blue-600 text-white text-sm font-medium rounded-lg transition-colors"
                >
                  Reconnect
                </button>
              )}
            </div>
          </div>
        </div>
      </header>

      {/* Main Content */}
      <main className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        {/* Connection Warning */}
        {!isConnected && (
          <div className="mb-6 bg-yellow-50 border-2 border-yellow-300 rounded-xl p-4">
            <div className="flex items-center space-x-3">
              <div className="text-3xl">⚠️</div>
              <div>
                <h3 className="font-bold text-yellow-900 mb-1">
                  WebSocket Disconnected
                </h3>
                <p className="text-sm text-yellow-800">
                  Real-time updates are unavailable. Make sure the backend server is running at{' '}
                  <code className="bg-yellow-100 px-2 py-1 rounded">
                    {process.env.NEXT_PUBLIC_WS_URL || 'ws://localhost:8000'}
                  </code>
                </p>
                <button
                  onClick={reconnect}
                  className="mt-2 text-sm font-medium text-yellow-900 underline hover:no-underline"
                >
                  Try reconnecting
                </button>
              </div>
            </div>
          </div>
        )}

        {/* Dashboard Grid */}
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          {/* Left Column - Mood Meter */}
          <div className="lg:col-span-2">
            <MoodMeter />
          </div>

          {/* Right Column - Portfolio */}
          <div className="lg:col-span-1">
            <PortfolioStatus />
          </div>

          {/* Second Row - AI Recommendation */}
          <div className="lg:col-span-2">
            <AiRecommendation symbol="BTC-USDT" />
          </div>

          {/* Trade Panel */}
          <div className="lg:col-span-1">
            <TradePanel defaultSymbol="BTC-USDT" />
          </div>
        </div>

        {/* Footer Info */}
        <div className="mt-8 text-center">
          <div className="inline-block bg-white rounded-lg shadow-sm border border-gray-200 px-6 py-4">
            <p className="text-sm text-gray-600">
              <span className="font-semibold text-gray-900">🎓 Educational Platform:</span>{' '}
              All trading is simulated. No real money involved. Learn without risk!
            </p>
          </div>
        </div>

        {/* Backend Status Check */}
        <div className="mt-6 text-center text-xs text-gray-500">
          <p>
            Backend API: <code className="bg-gray-100 px-2 py-1 rounded">{process.env.NEXT_PUBLIC_API_URL || 'http://localhost:8000'}</code>
          </p>
          <p className="mt-1">
            WebSocket: <code className="bg-gray-100 px-2 py-1 rounded">{process.env.NEXT_PUBLIC_WS_URL || 'ws://localhost:8000'}</code>
          </p>
        </div>
      </main>
    </div>
  );
}
