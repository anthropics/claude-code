using System;
using System.Collections.Generic;
using System.Linq;
using cAlgo.API;

namespace CCTTB
{
    public class BreakerBlock
    {
        public double HighPrice { get; set; }
        public double LowPrice  { get; set; }
        public BiasDirection Direction { get; set; }
        public DateTime Time { get; set; }
        public int Index { get; set; }
    }

    public static class BreakerBlockDetector
    {
        // Minimal heuristic: an OB that was violated creates a breaker in the opposite direction
        // Scan recent bars for a prior opposite candle engulfed and then broken.
        public static List<BreakerBlock> Detect(Bars bars, int lookback = 200)
        {
            var res = new List<BreakerBlock>();
            if (bars == null || bars.Count < 5) return res;

            int end = bars.Count - 1;
            int start = Math.Max(2, end - lookback);

            for (int i = start; i <= end; i++)
            {
                // Check a simple bearish breaker: previous up candle (i-1) whose low is later closed below
                int prev = i - 1;
                if (prev < 1) continue;

                // Up candle becomes potential bearish breaker if price closes below its low
                if (bars.ClosePrices[i] < bars.LowPrices[prev] && bars.OpenPrices[prev] < bars.ClosePrices[prev])
                {
                    res.Add(new BreakerBlock
                    {
                        Direction = BiasDirection.Bearish,
                        LowPrice = Math.Min(bars.LowPrices[prev], bars.LowPrices[i]),
                        HighPrice = Math.Max(bars.HighPrices[prev], bars.HighPrices[i]),
                        Time = bars.OpenTimes[prev],
                        Index = prev
                    });
                    continue;
                }

                // Down candle becomes potential bullish breaker if price closes above its high
                if (bars.ClosePrices[i] > bars.HighPrices[prev] && bars.OpenPrices[prev] > bars.ClosePrices[prev])
                {
                    res.Add(new BreakerBlock
                    {
                        Direction = BiasDirection.Bullish,
                        LowPrice = Math.Min(bars.LowPrices[prev], bars.LowPrices[i]),
                        HighPrice = Math.Max(bars.HighPrices[prev], bars.HighPrices[i]),
                        Time = bars.OpenTimes[prev],
                        Index = prev
                    });
                }
            }

            // Deduplicate by time
            return res.OrderByDescending(b => b.Time)
                      .GroupBy(b => b.Time)
                      .Select(g => g.First())
                      .ToList();
        }
    }
}

