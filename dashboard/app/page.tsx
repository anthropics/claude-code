"use client";

import { useState, useEffect, useCallback, useRef, useMemo } from "react";
import type { Market } from "@/lib/types";
import { SPORT_TABS } from "@/lib/polymarket";
import MarketCard from "@/components/MarketCard";
import SportsTabs from "@/components/SportsTabs";
import SkeletonCard from "@/components/SkeletonCard";

const REFRESH_INTERVAL = 30;

type SortKey = "volume" | "liquidity" | "time";

const SORT_OPTIONS: { value: SortKey; label: string }[] = [
  { value: "volume", label: "Volume" },
  { value: "liquidity", label: "Liquidity" },
  { value: "time", label: "Closing soon" },
];

export default function DashboardPage() {
  const [sport, setSport] = useState("all");
  const [markets, setMarkets] = useState<Market[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [countdown, setCountdown] = useState(REFRESH_INTERVAL);
  const [lastUpdated, setLastUpdated] = useState<Date | null>(null);
  const [search, setSearch] = useState("");
  const [sortBy, setSortBy] = useState<SortKey>("volume");

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

  useEffect(() => {
    fetchMarkets(sport);
  }, [sport, fetchMarkets]);

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
    setSearch("");
  };

  const displayedMarkets = useMemo(() => {
    let result = markets;

    if (search.trim()) {
      const q = search.trim().toLowerCase();
      result = result.filter((m) => m.question.toLowerCase().includes(q));
    }

    result = [...result].sort((a, b) => {
      if (sortBy === "volume") return b.volume - a.volume;
      if (sortBy === "liquidity") return b.liquidity - a.liquidity;
      // "time": nulls last, then ascending end date
      if (!a.endDate && !b.endDate) return 0;
      if (!a.endDate) return 1;
      if (!b.endDate) return -1;
      return new Date(a.endDate).getTime() - new Date(b.endDate).getTime();
    });

    return result;
  }, [markets, search, sortBy]);

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

      <main className="max-w-7xl mx-auto px-4 sm:px-6 py-6 space-y-4">
        {/* Sport filter tabs */}
        <SportsTabs
          tabs={SPORT_TABS}
          selected={sport}
          onChange={handleSportChange}
        />

        {/* Search + sort row */}
        <div className="flex flex-col sm:flex-row gap-3">
          <div className="relative flex-1">
            <span className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-500 text-sm pointer-events-none">
              🔍
            </span>
            <input
              type="text"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Search markets…"
              className="w-full bg-gray-900 border border-gray-800 rounded-lg pl-8 pr-3 py-2 text-sm text-gray-200 placeholder-gray-600 focus:outline-none focus:border-indigo-600 transition-colors"
            />
            {search && (
              <button
                onClick={() => setSearch("")}
                className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-600 hover:text-gray-400 transition-colors text-xs"
              >
                ✕
              </button>
            )}
          </div>

          <div className="flex items-center gap-2 shrink-0">
            <span className="text-xs text-gray-600">Sort:</span>
            <div className="flex gap-1">
              {SORT_OPTIONS.map((opt) => (
                <button
                  key={opt.value}
                  onClick={() => setSortBy(opt.value)}
                  className={`px-3 py-2 rounded-lg text-xs font-medium transition-all duration-150 ${
                    sortBy === opt.value
                      ? "bg-indigo-600 text-white"
                      : "bg-gray-900 text-gray-400 hover:bg-gray-800 hover:text-white border border-gray-800"
                  }`}
                >
                  {opt.label}
                </button>
              ))}
            </div>
          </div>
        </div>

        {/* Market count */}
        {!loading && !error && (
          <p className="text-xs text-gray-600">
            {displayedMarkets.length === 0
              ? search
                ? `No results for "${search}"`
                : "No active markets"
              : `${displayedMarkets.length}${search ? ` of ${markets.length}` : ""} active market${displayedMarkets.length !== 1 ? "s" : ""}`}
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
            : displayedMarkets.map((market) => (
                <MarketCard key={market.id} market={market} />
              ))}
        </div>

        {/* Empty state */}
        {!loading && !error && displayedMarkets.length === 0 && (
          <div className="py-20 text-center">
            <p className="text-4xl mb-3">{search ? "🔍" : "📭"}</p>
            <p className="text-gray-400 font-medium">
              {search
                ? `No markets matching "${search}"`
                : "No active markets for this sport right now"}
            </p>
            <p className="text-gray-600 text-sm mt-1">
              {search ? (
                <button
                  onClick={() => setSearch("")}
                  className="underline hover:no-underline"
                >
                  Clear search
                </button>
              ) : (
                "Check back later or try another sport"
              )}
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
