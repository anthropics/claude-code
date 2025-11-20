using System;
using System.Collections.Generic;
using System.Linq;
using cAlgo.API;  // for Bars

namespace CCTTB
{
    public class OptimalTradeEntryDetector
    {
        private readonly StrategyConfig _config;

        public OptimalTradeEntryDetector(StrategyConfig config)
        {
            _config = config;
        }

        // === Continuation OTE: re-anchor after impulse extension, gated by an opposite micro-break ===
        // Use case: After MSS confirms, price extends in the same direction without pulling back.
        // When an opposite-direction micro-break prints, treat that as the swing completion, and
        // anchor OTE from the pre-MSS swing (start) to the extreme reached prior to that opposite break.
        public List<OTEZone> DetectContinuationOTE(Bars bars, List<MSSSignal> mssSignals)
        {
            var zones = new List<OTEZone>();
            try
            {
                if (!_config?.EnableContinuationReanchorOTE ?? false) return zones;
                if (bars == null || bars.Count < 5 || mssSignals == null || mssSignals.Count == 0) return zones;

                // Use the latest MSS only to avoid clutter
                var sig = mssSignals.LastOrDefault();
                if (sig == null) return zones;

                int p = bars.Count - 2; // last closed bar
                if (sig.Index >= p) return zones;

                if (sig.Direction == BiasDirection.Bullish)
                {
                    int loIdx = FindSwingLow(bars, sig.Index - 1, pivot: 2, maxBack: 50);
                    if (loIdx < 0) return zones;

                    // Find the earliest opposite micro-break (bearish) after MSS
                    int brIdx = FirstOppositeBreakIndex(bars, sig.Index + 1, wantBullishBreak: false);
                    if (brIdx < 0) return zones; // no opposite break yet → no continuation OTE

                    // Use the highest high achieved before that opposite break as the impulse end
                    int iStart = Math.Max(sig.Index, loIdx);
                    int iEnd = Math.Max(iStart, brIdx - 1);
                    double swingHigh = double.MinValue;
                    for (int i = iStart; i <= iEnd; i++) swingHigh = Math.Max(swingHigh, bars.HighPrices[i]);
                    double swingLow = bars.LowPrices[loIdx];
                    if (!(swingHigh > swingLow)) return zones;

                    var lv = Fibonacci.CalculateOTE(swingLow, swingHigh, isBullish: true);
                    zones.Add(new OTEZone
                    {
                        Time = bars.OpenTimes[brIdx],
                        Direction = BiasDirection.Bullish,
                        OTE618 = lv.OTE618,
                        OTE79 = lv.OTE79,
                        ImpulseStart = swingLow,
                        ImpulseEnd = swingHigh
                    });
                }
                else if (sig.Direction == BiasDirection.Bearish)
                {
                    int hiIdx = FindSwingHigh(bars, sig.Index - 1, pivot: 2, maxBack: 50);
                    if (hiIdx < 0) return zones;

                    // Find the earliest opposite micro-break (bullish) after MSS
                    int brIdx = FirstOppositeBreakIndex(bars, sig.Index + 1, wantBullishBreak: true);
                    if (brIdx < 0) return zones; // no opposite break yet → no continuation OTE

                    // Use the lowest low achieved before that opposite break as the impulse end
                    int iStart = Math.Max(sig.Index, hiIdx);
                    int iEnd = Math.Max(iStart, brIdx - 1);
                    double swingLow = double.MaxValue;
                    for (int i = iStart; i <= iEnd; i++) swingLow = Math.Min(swingLow, bars.LowPrices[i]);
                    double swingHigh = bars.HighPrices[hiIdx];
                    if (!(swingHigh > swingLow)) return zones;

                    var lv = Fibonacci.CalculateOTE(swingHigh, swingLow, isBullish: false);
                    zones.Add(new OTEZone
                    {
                        Time = bars.OpenTimes[brIdx],
                        Direction = BiasDirection.Bearish,
                        OTE618 = lv.OTE618,
                        OTE79 = lv.OTE79,
                        ImpulseStart = swingHigh,
                        ImpulseEnd = swingLow
                    });
                }

                int cap = Math.Max(1, _config?.MaxOTEBoxes ?? 4);
                return zones.OrderByDescending(z => z.Time).Take(cap).ToList();
            }
            catch
            {
                return zones;
            }
        }

        // === ALTERNATIVE OTE: Sweep-to-MSS swing range (user requested) ===
        // Uses last sweep candle (high/low) to last candle before MSS as swing range for OTE calculation
        // This creates OTE box from the actual sweep liquidity grab to the structure shift
        public List<OTEZone> DetectOTEFromSweepToMSS(Bars bars, List<LiquiditySweep> sweeps, List<MSSSignal> mssSignals)
        {
            var zones = new List<OTEZone>();
            if (bars == null || bars.Count < 5 || sweeps == null || sweeps.Count == 0 || mssSignals == null || mssSignals.Count == 0)
                return zones;

            try
            {
                // Use latest sweep and MSS
                var lastSweep = sweeps.LastOrDefault();
                var lastMss = mssSignals.LastOrDefault();
                if (lastSweep == null || lastMss == null) return zones;

                // Find sweep candle index
                int sweepIdx = -1;
                for (int i = bars.Count - 1; i >= 0; i--)
                {
                    if (bars.OpenTimes[i] == lastSweep.Time)
                    {
                        sweepIdx = i;
                        break;
                    }
                }
                if (sweepIdx < 0 || sweepIdx >= bars.Count - 1) return zones;

                // MSS index
                int mssIdx = lastMss.Index;
                if (mssIdx <= sweepIdx || mssIdx >= bars.Count) return zones;

                // Last candle before MSS (pre-MSS candle)
                int preMssIdx = mssIdx - 1;
                if (preMssIdx <= sweepIdx) return zones;

                if (lastSweep.IsBullish) // Bullish sweep → Bearish OTE (expect price to retrace down)
                {
                    // Swing High: highest point from sweep to pre-MSS
                    double swingHigh = double.MinValue;
                    for (int i = sweepIdx; i <= preMssIdx; i++)
                        swingHigh = Math.Max(swingHigh, bars.HighPrices[i]);

                    // Swing Low: lowest point from sweep to pre-MSS (usually sweep candle low)
                    double swingLow = double.MaxValue;
                    for (int i = sweepIdx; i <= preMssIdx; i++)
                        swingLow = Math.Min(swingLow, bars.LowPrices[i]);

                    if (swingHigh <= swingLow) return zones;

                    // Calculate bearish OTE (price expected to drop into 62-79% zone)
                    var lv = Fibonacci.CalculateOTE(swingHigh, swingLow, isBullish: false);
                    zones.Add(new OTEZone
                    {
                        Time = bars.OpenTimes[mssIdx],
                        Direction = BiasDirection.Bearish,
                        OTE618 = lv.OTE618,
                        OTE79 = lv.OTE79,
                        ImpulseStart = swingHigh,
                        ImpulseEnd = swingLow
                    });
                }
                else // Bearish sweep → Bullish OTE (expect price to retrace up)
                {
                    // Swing Low: lowest point from sweep to pre-MSS
                    double swingLow = double.MaxValue;
                    for (int i = sweepIdx; i <= preMssIdx; i++)
                        swingLow = Math.Min(swingLow, bars.LowPrices[i]);

                    // Swing High: highest point from sweep to pre-MSS (usually sweep candle high)
                    double swingHigh = double.MinValue;
                    for (int i = sweepIdx; i <= preMssIdx; i++)
                        swingHigh = Math.Max(swingHigh, bars.HighPrices[i]);

                    if (swingHigh <= swingLow) return zones;

                    // Calculate bullish OTE (price expected to rise into 62-79% zone)
                    var lv = Fibonacci.CalculateOTE(swingLow, swingHigh, isBullish: true);
                    zones.Add(new OTEZone
                    {
                        Time = bars.OpenTimes[mssIdx],
                        Direction = BiasDirection.Bullish,
                        OTE618 = lv.OTE618,
                        OTE79 = lv.OTE79,
                        ImpulseStart = swingLow,
                        ImpulseEnd = swingHigh
                    });
                }

                return zones;
            }
            catch
            {
                return zones;
            }
        }

        // === OTE derived from the MSS swing that made the break ===
        public List<OTEZone> DetectOTEFromMSS(Bars bars, List<MSSSignal> mssSignals)
        {
            var zones = new List<OTEZone>();
            if (bars == null || bars.Count < 5 || mssSignals == null) return zones;

            foreach (var sig in mssSignals)
            {
                if (sig == null) continue;
                int i = sig.Index;
                if (i <= 2 || i >= bars.Count) continue;

                if (sig.Direction == BiasDirection.Bullish)
                {
                    int loIdx = FindSwingLow(bars, i - 1, pivot: 2, maxBack: 50);
                    if (loIdx < 0) continue;

                    double swingLow  = bars.LowPrices[loIdx];
                    double swingHigh = bars.HighPrices[i]; // break bar’s high
                    if (swingHigh <= swingLow) continue;

                    var lv = Fibonacci.CalculateOTE(swingLow, swingHigh, isBullish: true);
                    zones.Add(new OTEZone
                    {
                        Time         = bars.OpenTimes[i],
                        Direction    = BiasDirection.Bullish,
                        OTE618       = lv.OTE618,
                        OTE79        = lv.OTE79,
                        ImpulseStart = swingLow,
                        ImpulseEnd   = swingHigh
                    });
                }
                else // Bearish
                {
                    int hiIdx = FindSwingHigh(bars, i - 1, pivot: 2, maxBack: 50);
                    if (hiIdx < 0) continue;

                    double swingHigh = bars.HighPrices[hiIdx];
                    double swingLow  = bars.LowPrices[i];   // break bar’s low
                    if (swingHigh <= swingLow) continue;

                    var lv = Fibonacci.CalculateOTE(swingHigh, swingLow, isBullish: false);
                    zones.Add(new OTEZone
                    {
                        Time         = bars.OpenTimes[i],
                        Direction    = BiasDirection.Bearish,
                        OTE618       = lv.OTE618,
                        OTE79        = lv.OTE79,
                        ImpulseStart = swingHigh,
                        ImpulseEnd   = swingLow
                    });
                }
            }

            int cap = Math.Max(1, _config?.MaxOTEBoxes ?? 4);
            return zones.OrderByDescending(z => z.Time).Take(cap).ToList();
        }

        // ---- pivot helpers ----
        private static int FirstOppositeBreakIndex(Bars bars, int fromIndex, bool wantBullishBreak)
        {
            // Simple micro-break: bullish break if current high > previous high on a bullish candle;
            // bearish break if current low < previous low on a bearish candle.
            for (int i = Math.Max(1, fromIndex); i < bars.Count - 1; i++)
            {
                bool isBull = bars.ClosePrices[i] >= bars.OpenPrices[i];
                if (wantBullishBreak)
                {
                    if (isBull && bars.HighPrices[i] > bars.HighPrices[i - 1]) return i;
                }
                else
                {
                    bool isBear = !isBull;
                    if (isBear && bars.LowPrices[i] < bars.LowPrices[i - 1]) return i;
                }
            }
            return -1;
        }

        private static int FindSwingLow(Bars bars, int fromIndex, int pivot = 2, int maxBack = 50)
        {
            int start = Math.Max(1 + pivot, fromIndex);
            int end   = Math.Max(1 + pivot, fromIndex - maxBack);
            for (int i = start; i >= end; i--)
            {
                bool isLow = true;
                for (int k = 1; k <= pivot; k++)
                {
                    if (i - k < 0 || i + k >= bars.Count) { isLow = false; break; }
                    if (!(bars.LowPrices[i] < bars.LowPrices[i - k] && bars.LowPrices[i] < bars.LowPrices[i + k]))
                    { isLow = false; break; }
                }
                if (isLow) return i;
            }
            return -1;
        }

        private static int FindSwingHigh(Bars bars, int fromIndex, int pivot = 2, int maxBack = 50)
        {
            int start = Math.Max(1 + pivot, fromIndex);
            int end   = Math.Max(1 + pivot, fromIndex - maxBack);
            for (int i = start; i >= end; i--)
            {
                bool isHigh = true;
                for (int k = 1; k <= pivot; k++)
                {
                    if (i - k < 0 || i + k >= bars.Count) { isHigh = false; break; }
                    if (!(bars.HighPrices[i] > bars.HighPrices[i - k] && bars.HighPrices[i] > bars.HighPrices[i + k]))
                    { isHigh = false; break; }
                }
                if (isHigh) return i;
            }
            return -1;
        }
    }
}
