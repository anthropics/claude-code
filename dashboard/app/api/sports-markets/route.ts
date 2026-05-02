import { NextRequest, NextResponse } from "next/server";
import { fetchSportsMarkets } from "@/lib/polymarket";

export const runtime = "edge";

export async function GET(request: NextRequest) {
  const sport = new URL(request.url).searchParams.get("sport") ?? "all";

  const markets = await fetchSportsMarkets(sport);

  return NextResponse.json(markets, {
    headers: {
      "Cache-Control": "public, s-maxage=30, stale-while-revalidate=60",
    },
  });
}
