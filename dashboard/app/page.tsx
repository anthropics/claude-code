"use client";

import { useState, useEffect, useCallback, useRef } from "react";
import type { Market } from "@/lib/types";
import { SPORT_TABS } from "@/lib/polymarket";
import MarketCard from "@/components/MarketCard";
import SportsTabs from "@/components/SportsTabs";
import SkeletonCard from "@/components/SkeletonCard";

const REFRESH_INTERVAL = 30; // seconds

export default function DashboardPage() {
  const [sport, setSport] = useState("all");
  const [markets, setMarkets] = useState<Market[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [countdown, setCountdown] = useState(REFRESH_INTERVAL);
  const [lastUpdated, setLastUpdated] = useState<Date | null>(null);

  // Ref so the countdown effect always has the latest sport without re-registering
  const sportRef = useRef(sport);
  sportRef.current = sport;

  const fetchMarkets = useCallback(async (selectedSport: string) => {
    setLoading(true);
    setError(null);
    try {
      const res = await fetch(`/api/sports-markets?sport=${selectedSport}`);
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      const data: Market[] = await res.json();
      setMarkets(data);
      setLastUpdated(new Date());
      setCountdown(REFRESH_INTERVAL);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Failed to load markets");
    } finally {
      setLoading(false);
    }
  }, []);

  // Fetch on sport change
  useEffect(() => {
    fetchMarkets(sport);
  }, [sport, fetchMarkets]);

  // Countdown + auto-refresh
  useEffect(() => {
    const interval = setInterval(() => {
      setCountdown((s) => {
        if (s <= 1) {
          fetchMarkets(sportRef.current);
          return REFRESH_INTERVAL;
        }
        return s - 1;
      });
    }, 1000);
    return () => clearInterval(interval);
  }, [fetchMarkets]);

  const handleSportChange = (slug: string) => {
    setSport(slug);
    setCountdown(REFRESH_INTERVAL);
  };

  return (
    <div className="min-h-screen bg-gray-950">
      {/* Sticky header */}
      <header className="sticky top-0 z-20 border-b border-gray-800 bg-gray-950/90 backdrop-blur-sm">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 py-3 flex items-center justify-between gap-4">
          <div className="flex items-center gap-3">
            <span className="text-2xl select-none">📈</span>
            <div>
              <h1 className="text-base font-bold text-white leading-tight">
                Sports Markets
              </h1>
              <p className="text-xs text-gray-500 leading-tight hidden sm:block">
                Live prediction markets · Polymarket
              </p>
            </div>
          </div>

          <div className="flex items-center gap-3">
            {lastUpdated && (
              <span className="text-xs text-gray-600 hidden md:block">
                {lastUpdated.toLocaleTimeString([], {
                  hour: "2-digit",
                  minute: "2-digit",
                  second: "2-digit",
                })}
              </span>
            )}
            <button
              onClick={() => fetchMarkets(sport)}
              title="Refresh now"
              className="flex items-center gap-1.5 text-xs text-emerald-400 hover:text-emerald-300 transition-colors"
            >
              <span
                className={`w-2 h-2 rounded-full bg-emerald-400 ${
                  loading ? "animate-ping" : "animate-pulse"
                }`}
              />
              <span className="font-medium">
                {loading ? "Loading…" : `${countdown}s`}
              </span>
            </button>
          </div>
        </div>
      </header>

      <main className="max-w-7xl mx-auto px-4 sm:px-6 py-6 space-y-6">
        {/* Sport filter tabs */}
        <SportsTabs
          tabs={SPORT_TABS}
          selected={sport}
          onChange={handleSportChange}
        />

        {/* Market count */}
        {!loading && !error && (
          <p className="text-xs text-gray-600">
            {markets.length === 0
              ? "No active markets"
              : `${markets.length} active market${markets.length !== 1 ? "s" : ""}`}
          </p>
        )}

        {/* Error state */}
        {error && (
          <div className="p-4 bg-rose-950/60 border border-rose-800/60 rounded-lg text-rose-400 text-sm flex items-center gap-2">
            <span>⚠️</span>
            <span>{error}</span>
            <button
              onClick={() => fetchMarkets(sport)}
              className="ml-auto underline hover:no-underline text-rose-300"
            >
              Retry
            </button>
          </div>
        )}

        {/* Cards grid */}
        <div className="grid gap-4 grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
          {loading
            ? Array.from({ length: 8 }).map((_, i) => <SkeletonCard key={i} />)
            : markets.map((market) => (
                <MarketCard key={market.id} market={market} />
              ))}
        </div>

        {/* Empty state */}
        {!loading && !error && markets.length === 0 && (
          <div className="py-20 text-center">
            <p className="text-4xl mb-3">🔍</p>
            <p className="text-gray-400 font-medium">
              No active markets for this sport right now
            </p>
            <p className="text-gray-600 text-sm mt-1">
              Check back later or try another sport
            </p>
          </div>
        )}
      </main>

      <footer className="mt-10 border-t border-gray-900 py-6 text-center text-xs text-gray-700">
        Data from{" "}
        <a
          href="https://polymarket.com"
          target="_blank"
          rel="noopener noreferrer"
          className="hover:text-gray-500 underline transition-colors"
        >
          Polymarket
        </a>{" "}
        · Refreshes every {REFRESH_INTERVAL}s · Not financial advice
      </footer>
    </div>
  );
}
