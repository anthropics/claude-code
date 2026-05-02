import type { Market } from "@/lib/types";

const SPORT_ICONS: Record<string, string> = {
  tennis: "🎾",
  nba: "🏀",
  soccer: "⚽",
  nfl: "🏈",
  mlb: "⚾",
  golf: "⛳",
  mma: "🥊",
  cricket: "🏏",
};

function formatVolume(v: number): string {
  if (v >= 1_000_000) return `$${(v / 1_000_000).toFixed(1)}M`;
  if (v >= 1_000) return `$${(v / 1_000).toFixed(0)}K`;
  return `$${v.toFixed(0)}`;
}

function formatTimeLeft(endDate: string | null): string {
  if (!endDate) return "";
  const diff = new Date(endDate).getTime() - Date.now();
  if (diff <= 0) return "Ended";
  const days = Math.floor(diff / 86_400_000);
  if (days > 1) return `${days}d left`;
  const hours = Math.floor(diff / 3_600_000);
  if (hours > 0) return `${hours}h left`;
  const mins = Math.floor(diff / 60_000);
  return `${mins}m left`;
}

interface Props {
  market: Market;
}

export default function MarketCard({ market }: Props) {
  const { question, outcomePrices, outcomes, volume, liquidity, endDate, sport, slug, image } =
    market;

  const timeLeft = formatTimeLeft(endDate);
  const polymarketUrl = `https://polymarket.com/event/${slug}`;

  const isYesNo =
    outcomes.length === 2 &&
    outcomes[0]?.toLowerCase() === "yes" &&
    outcomes[1]?.toLowerCase() === "no";

  const yesPrice = outcomePrices[0] ?? 0;

  return (
    <a
      href={polymarketUrl}
      target="_blank"
      rel="noopener noreferrer"
      className="group flex flex-col bg-gray-900 border border-gray-800 rounded-xl overflow-hidden hover:border-indigo-500/60 transition-all duration-200 hover:shadow-lg hover:shadow-indigo-500/10"
    >
      {/* Banner image */}
      {image && (
        // eslint-disable-next-line @next/next/no-img-element
        <img
          src={image}
          alt=""
          className="w-full h-24 object-cover opacity-80 group-hover:opacity-100 transition-opacity duration-200"
        />
      )}

      <div className="flex flex-col flex-1 p-4">
        {/* Sport icon + time badge */}
        <div className="flex items-center justify-between mb-3">
          <span className="text-lg leading-none">
            {SPORT_ICONS[sport] ?? "🏅"}
          </span>
          {timeLeft && (
            <span
              className={`text-xs px-2 py-0.5 rounded-full font-medium ${
                timeLeft === "Ended"
                  ? "bg-gray-800 text-gray-500"
                  : "bg-indigo-950 text-indigo-300 border border-indigo-800/50"
              }`}
            >
              {timeLeft}
            </span>
          )}
        </div>

        {/* Question */}
        <p className="text-sm text-gray-100 font-medium leading-snug mb-4 flex-1 line-clamp-3 group-hover:text-white transition-colors">
          {question}
        </p>

        {/* Probability display */}
        {isYesNo ? (
          <YesNoBar yesPrice={yesPrice} />
        ) : outcomes.length > 0 ? (
          <OutcomeList outcomes={outcomes} prices={outcomePrices} />
        ) : null}

        {/* Footer */}
        <div className="mt-3 pt-3 border-t border-gray-800 flex items-center justify-between gap-2">
          <div className="flex items-center gap-2 text-xs text-gray-500 min-w-0">
            <span>
              Vol <span className="text-gray-400 font-medium">{formatVolume(volume)}</span>
            </span>
            {liquidity > 0 && (
              <>
                <span className="text-gray-700">·</span>
                <span>
                  Liq <span className="text-gray-400 font-medium">{formatVolume(liquidity)}</span>
                </span>
              </>
            )}
          </div>
          <span className="text-xs text-indigo-400 group-hover:text-indigo-300 transition-colors shrink-0">
            Trade →
          </span>
        </div>
      </div>
    </a>
  );
}

function YesNoBar({ yesPrice }: { yesPrice: number }) {
  const yesPct = Math.round(yesPrice * 100);
  const noPct = 100 - yesPct;

  return (
    <div className="space-y-1.5">
      <div className="flex justify-between text-xs mb-1">
        <span className="text-gray-400">
          Yes{" "}
          <span className="font-semibold text-emerald-400">{yesPct}¢</span>
        </span>
        <span className="text-gray-400">
          No <span className="font-semibold text-rose-400">{noPct}¢</span>
        </span>
      </div>
      <div className="h-2 bg-gray-800 rounded-full overflow-hidden">
        <div
          className="h-full bg-gradient-to-r from-emerald-500 to-emerald-400 rounded-full transition-all duration-500"
          style={{ width: `${yesPct}%` }}
        />
      </div>
    </div>
  );
}

function OutcomeList({
  outcomes,
  prices,
}: {
  outcomes: string[];
  prices: number[];
}) {
  // Show top 4 outcomes by price
  const indexed = outcomes
    .map((o, i) => ({ label: o, price: prices[i] ?? 0 }))
    .sort((a, b) => b.price - a.price)
    .slice(0, 4);

  return (
    <div className="space-y-1.5">
      {indexed.map(({ label, price }, i) => (
        <div key={i} className="flex items-center gap-2">
          <div className="h-1.5 bg-gray-800 rounded-full flex-1 overflow-hidden">
            <div
              className="h-full bg-indigo-500 rounded-full transition-all duration-500"
              style={{ width: `${Math.round(price * 100)}%` }}
            />
          </div>
          <span className="text-xs text-gray-300 w-28 truncate">{label}</span>
          <span className="text-xs font-semibold text-indigo-300 w-7 text-right">
            {Math.round(price * 100)}¢
          </span>
        </div>
      ))}
    </div>
  );
}
