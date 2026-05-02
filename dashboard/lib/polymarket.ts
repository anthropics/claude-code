import type { Market, SportTab } from "./types";

const GAMMA_API = "https://gamma-api.polymarket.com";

// Tennis is listed first so it appears first in "All Sports" results
export const SPORT_TABS: SportTab[] = [
  { label: "All Sports", slug: "all", icon: "🏆" },
  { label: "Tennis", slug: "tennis", icon: "🎾" },
  { label: "Basketball", slug: "nba", icon: "🏀" },
  { label: "Soccer", slug: "soccer", icon: "⚽" },
  { label: "NFL", slug: "nfl", icon: "🏈" },
  { label: "Baseball", slug: "mlb", icon: "⚾" },
  { label: "Golf", slug: "golf", icon: "⛳" },
  { label: "MMA", slug: "mma", icon: "🥊" },
  { label: "Cricket", slug: "cricket", icon: "🏏" },
];

const SPORT_SLUGS = SPORT_TABS.filter((t) => t.slug !== "all").map(
  (t) => t.slug
);

// How many markets to fetch per sport in "All" mode
const ALL_SPORT_LIMITS: Record<string, number> = { tennis: 12 };
const ALL_SPORT_DEFAULT_LIMIT = 4;
const SINGLE_SPORT_LIMIT = 20;

type RawMarket = Record<string, unknown>;

function normalizeMarket(raw: RawMarket, sport: string): Market | null {
  const question =
    (raw.question as string) || (raw.groupItemTitle as string) || "";
  if (!question.trim()) return null;

  let outcomePrices: number[] = [];
  let outcomes: string[] = [];

  try {
    const raw_prices = raw.outcomePrices;
    const prices =
      typeof raw_prices === "string" ? JSON.parse(raw_prices) : raw_prices;
    if (Array.isArray(prices)) {
      outcomePrices = prices.map((p: unknown) => parseFloat(String(p)));
    }
  } catch {
    /* ignore malformed prices */
  }

  try {
    const raw_outcomes = raw.outcomes;
    const parsed =
      typeof raw_outcomes === "string"
        ? JSON.parse(raw_outcomes)
        : raw_outcomes;
    if (Array.isArray(parsed)) {
      outcomes = parsed.map(String);
    }
  } catch {
    /* ignore malformed outcomes */
  }

  return {
    id: String(raw.id),
    question: question.trim(),
    slug: String(raw.slug || raw.conditionId || raw.id),
    outcomePrices,
    outcomes,
    volume: Number(raw.volumeNum ?? raw.volume ?? 0),
    liquidity: Number(raw.liquidityNum ?? raw.liquidity ?? 0),
    endDate: (raw.endDate as string) || null,
    sport,
    image: (raw.image as string) || undefined,
  };
}

async function fetchBySlug(
  slug: string,
  limit: number,
  init?: RequestInit
): Promise<Market[]> {
  const url =
    `${GAMMA_API}/markets?tag_slug=${slug}&active=true&closed=false` +
    `&limit=${limit}&order=volume&ascending=false`;

  let res: Response;
  try {
    res = await fetch(url, {
      ...init,
      headers: { Accept: "application/json" },
    });
  } catch {
    return [];
  }

  if (!res.ok) return [];

  let data: unknown;
  try {
    data = await res.json();
  } catch {
    return [];
  }

  const items: RawMarket[] = Array.isArray(data) ? data : [];
  return items
    .map((m) => normalizeMarket(m, slug))
    .filter((m): m is Market => m !== null);
}

export async function fetchSportsMarkets(
  sport: string,
  init?: RequestInit
): Promise<Market[]> {
  if (sport !== "all") {
    return fetchBySlug(sport, SINGLE_SPORT_LIMIT, init);
  }

  // Fetch all sports in parallel; tennis gets more slots and comes first
  const results = await Promise.all(
    SPORT_SLUGS.map((slug) =>
      fetchBySlug(slug, ALL_SPORT_LIMITS[slug] ?? ALL_SPORT_DEFAULT_LIMIT, init)
    )
  );

  // Flatten and deduplicate by id, preserving order (tennis first)
  const seen = new Set<string>();
  const markets: Market[] = [];
  for (const group of results) {
    for (const m of group) {
      if (!seen.has(m.id)) {
        seen.add(m.id);
        markets.push(m);
      }
    }
  }
  return markets;
}
