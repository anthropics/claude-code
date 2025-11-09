'use client';

import { useState } from 'react';
import ClaudeLogo from './ClaudeLogo';

interface LoginProps {
  onLogin: (token: string, username: string) => void;
}

export default function Login({ onLogin }: LoginProps) {
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [isLoading, setIsLoading] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    setIsLoading(true);

    try {
      // Use the current hostname's IP for backend, or localhost if local
      const backendUrl = typeof window !== 'undefined' && window.location.hostname !== 'localhost'
        ? `http://${window.location.hostname}:3001`
        : 'http://localhost:3001';

      const response = await fetch(`${backendUrl}/api/login`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ username, password }),
      });

      if (!response.ok) {
        throw new Error('Invalid credentials');
      }

      const data = await response.json();
      onLogin(data.token, data.username);
    } catch (err) {
      setError('Invalid username or password');
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="flex h-screen items-center justify-center" style={{ backgroundColor: 'rgb(250, 249, 245)', padding: '24px' }}>
      <div className="w-full max-w-md">
        <div className="mb-8 text-center">
          <div className="mb-6 flex justify-center">
            <ClaudeLogo size={64} />
          </div>
          <h1 className="text-2xl font-semibold text-zinc-900">
            AIVA
          </h1>
          <p className="mt-2 text-zinc-600">
            Sign in to continue
          </p>
        </div>

        <form onSubmit={handleSubmit}>
          <div className="mb-4">
            <label htmlFor="username" className="block text-sm font-medium text-zinc-700 mb-2">
              Username
            </label>
            <input
              id="username"
              type="text"
              value={username}
              onChange={(e) => setUsername(e.target.value)}
              className="w-full rounded-lg px-4 py-3 text-zinc-900 focus:outline-none focus:ring-2 focus:ring-blue-500/20 transition-colors"
              style={{
                border: '1px solid rgba(31, 30, 29, 0.15)',
                backgroundColor: 'rgb(255, 255, 255)'
              }}
              required
            />
          </div>

          <div className="mb-4">
            <label htmlFor="password" className="block text-sm font-medium text-zinc-700 mb-2">
              Password
            </label>
            <input
              id="password"
              type="password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              className="w-full rounded-lg px-4 py-3 text-zinc-900 focus:outline-none focus:ring-2 focus:ring-blue-500/20 transition-colors"
              style={{
                border: '1px solid rgba(31, 30, 29, 0.15)',
                backgroundColor: 'rgb(255, 255, 255)'
              }}
              required
            />
          </div>

          {error && (
            <div className="rounded-lg bg-red-50 p-3 text-sm text-red-600 mb-4">
              {error}
            </div>
          )}

          <div style={{ marginTop: '16px' }}>
          <button
            type="submit"
            disabled={isLoading}
            className="w-full rounded-lg px-4 py-3 text-zinc-900 font-medium disabled:opacity-50 disabled:cursor-not-allowed transition-colors hover:bg-zinc-100"
            style={{
              backgroundColor: 'rgb(255, 255, 255)',
              border: '1px solid rgba(31, 30, 29, 0.15)'
            }}
          >
            {isLoading ? 'Signing in...' : 'Sign in'}
          </button>
          </div>
        </form>
      </div>
    </div>
  );
}
