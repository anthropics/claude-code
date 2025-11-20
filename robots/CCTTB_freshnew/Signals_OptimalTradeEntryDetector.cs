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

        // === Validate if MSS is "REAL" (not fake/weak) ===
        // Real MSS requires: strong move, clear break, proper context
        // NOTE: Relaxed validation to show more OTE zones (user can fine-tune later)
        private bool IsRealMSS(MSSSignal mss, Bars bars)
        {
            if (mss == null || bars == null) return false;

            int idx = mss.Index;
            if (idx < 5 || idx >= bars.Count - 1) return false;

            // Check 1: MSS must have reasonable momentum (relaxed from 60% to 25%)
            double mssRange = Math.Abs(bars.ClosePrices[idx] - bars.OpenPrices[idx]);
            double avgRange = 0;
            for (int i = 1; i <= 5; i++)
            {
                if (idx - i >= 0)
                    avgRange += Math.Abs(bars.ClosePrices[idx - i] - bars.OpenPrices[idx - i]);
            }
            avgRange /= 5;

            // MSS candle should be at least 25% of average range (relaxed for visibility)
            if (avgRange > 0 && mssRange < avgRange * 0.25) return false;

            // Check 2: Must have structure break (relaxed - just needs ANY break)
            if (mss.Direction == BiasDirection.Bullish)
            {
                // Bullish MSS: should break above recent prices
                double recentHigh = double.MinValue;
                for (int i = Math.Max(0, idx - 10); i < idx; i++)
                {
                    recentHigh = Math.Max(recentHigh, bars.HighPrices[i]);
                }

                // MSS high must break above (relaxed - allows equal or slight above)
                if (bars.HighPrices[idx] < recentHigh * 0.9999) return false;
            }
            else if (mss.Direction == BiasDirection.Bearish)
            {
                // Bearish MSS: should break below recent prices
                double recentLow = double.MaxValue;
                for (int i = Math.Max(0, idx - 10); i < idx; i++)
                {
                    recentLow = Math.Min(recentLow, bars.LowPrices[i]);
                }

                // MSS low must break below (relaxed - allows equal or slight below)
                if (bars.LowPrices[idx] > recentLow * 1.0001) return false;
            }

            // Check 3: MSS must have some meaningful move (relaxed from 40% to 15%)
            double high10 = double.MinValue;
            double low10 = double.MaxValue;
            for (int i = Math.Max(0, idx - 10); i < idx; i++)
            {
                high10 = Math.Max(high10, bars.HighPrices[i]);
                low10 = Math.Min(low10, bars.LowPrices[i]);
            }

            double consolidationRange = high10 - low10;
            if (consolidationRange > 0)
            {
                double mssMove = mss.Direction == BiasDirection.Bullish
                    ? (bars.HighPrices[idx] - low10)
                    : (high10 - bars.LowPrices[idx]);

                // MSS move should be at least 15% of consolidation range (relaxed for visibility)
                if (mssMove < consolidationRange * 0.15) return false;
            }

            return true; // All checks passed - this is a REAL MSS (with relaxed thresholds)
        }

        // === OTE derived from REAL MSS (filtered for quality) ===
        public List<OTEZone> DetectOTEFromMSS(Bars bars, List<MSSSignal> mssSignals)
        {
            var zones = new List<OTEZone>();
            if (bars == null || bars.Count < 5 || mssSignals == null) return zones;

            foreach (var sig in mssSignals)
            {
                if (sig == null) continue;

                // ✅ CRITICAL: Validate this is a REAL MSS (not fake/weak)
                if (!IsRealMSS(sig, bars))
                {
                    // Skip fake/weak MSS - don't create OTE zones for noise
                    continue;
                }

                int i = sig.Index;
                if (i <= 2 || i >= bars.Count) continue;

                if (sig.Direction == BiasDirection.Bullish)
                {
                    int loIdx = FindSwingLow(bars, i - 1, pivot: 2, maxBack: 50);
                    if (loIdx < 0) continue;

                    double swingLow  = bars.LowPrices[loIdx];
                    double swingHigh = bars.HighPrices[i]; // break bar's high

                    // ✅ Additional validation: swing must be significant
                    double swingRange = swingHigh - swingLow;
                    if (swingRange <= 0) continue;

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
                    double swingLow  = bars.LowPrices[i];   // break bar's low

                    // ✅ Additional validation: swing must be significant
                    double swingRange = swingHigh - swingLow;
                    if (swingRange <= 0) continue;

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
