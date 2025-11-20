using cAlgo.API;
using cAlgo.API.Internals;
using System;
using System.Collections.Generic;
using System.Linq;

namespace CCTTB
{
    // MSSSignal type is centralized in MSSSignal.cs (root namespace). This detector will
    // construct and return instances of that shared MSSignal type.

    public class MSSignalDetector
    {
        private readonly StrategyConfig _config;
        private readonly MarketDataProvider _marketData;

        public MSSignalDetector(StrategyConfig config, MarketDataProvider marketData)
        {
            _config = config;
            _marketData = marketData;
        }

        public List<global::CCTTB.MSSSignal> DetectMSS(Bars bars, List<LiquiditySweep> sweeps)
        {
            var signals = new List<global::CCTTB.MSSSignal>();
            if (bars == null || bars.Count < 6) return signals;

            sweeps ??= new List<LiquiditySweep>();

            // Scan last 20 bars for MSS signals (optimized for fresh, relevant MSS only)
            int start = Math.Max(3, bars.Count - 20);
            int end = bars.Count - 1;

            for (int i = start; i <= end; i++)
            {
                var signal = CheckForMSS(bars, i);
                if (signal == null) continue;

                if (ValidateMSS(signal, sweeps))
                    signals.Add(signal);
            }
            return signals;
        }

    private global::CCTTB.MSSSignal CheckForMSS(Bars bars, int index)
        {
            if (index < 3 || index >= bars.Count) return null;

            double open = bars.OpenPrices[index];
            double close = bars.ClosePrices[index];
            double high = bars.HighPrices[index];
            double low = bars.LowPrices[index];

            double range = Math.Max(high - low, 1e-9);
            double body = Math.Abs(close - open);

            double upperWick = Math.Max(0.0, high - Math.Max(open, close));
            double lowerWick = Math.Max(0.0, Math.Min(open, close) - low);
            double wickLen = Math.Max(upperWick, lowerWick);

            double bodyPercent = body / range * 100.0;
            double wickPercent = wickLen / range * 100.0;
            double combinedPercent = (body + wickLen) / range * 100.0;

            bool isValidBreak = _config.MSSBreakType switch
            {
                MSSBreakTypeEnum.Both => combinedPercent >= _config.BothThreshold,
                MSSBreakTypeEnum.WickOnly => wickPercent >= _config.WickThreshold,
                MSSBreakTypeEnum.BodyPercentOnly => bodyPercent >= _config.BodyPercentThreshold,
                _ => false
            };
            if (!isValidBreak) return null;

            // simple break vs previous bar's extremes
            bool bullishBreak = close > bars.HighPrices[index - 1];
            bool bearishBreak = close < bars.LowPrices[index - 1];
            if (!(bullishBreak || bearishBreak)) return null;

            // MSS direction matches BREAK direction (structure shift direction)
            // - Bullish break (close above prior high) → Bullish MSS
            // - Bearish break (close below prior low) → Bearish MSS
            // This aligns with sweep reversal: EQH swept → price reverses down → bearish break → bearish MSS
            var sig = new global::CCTTB.MSSSignal
            {
                Index = index,
                Price = close,
                Direction = bullishBreak ? BiasDirection.Bullish : BiasDirection.Bearish,
                Time = bars.OpenTimes[index],
                BodyPercent = bodyPercent,
                WickPercent = wickPercent,
                CombinedPercent = combinedPercent,
                IsValid = false, // set in ValidateMSS
                Score = 0
            };

            // refine anchors for fib/EQ/OTE pack
            int pivot = 2;
            if (sig.Direction == BiasDirection.Bullish)
            {
                var lows = bars.LowPrices.Select(x => (double)x).ToList();
                int loIdx = CCTTB.MSS.Core.Detectors.SwingDetector.LastSwingLowBefore(lows, index - 1, pivot: pivot, strict: true);
                if (loIdx >= 0)
                {
                    sig.SwingLow = bars.LowPrices[loIdx];
                    sig.SwingLowTime = bars.OpenTimes[loIdx];
                    sig.SwingHigh = 0.0;
                    sig.ImpulseStart = sig.SwingLow;
                    sig.ImpulseEnd = bars.HighPrices[index];
                }
            }
            else // Bearish
            {
                var highs = bars.HighPrices.Select(x => (double)x).ToList();
                int hiIdx = CCTTB.MSS.Core.Detectors.SwingDetector.LastSwingHighBefore(highs, index - 1, pivot: pivot, strict: true);
                if (hiIdx >= 0)
                {
                    sig.SwingHigh = bars.HighPrices[hiIdx];
                    sig.SwingHighTime = bars.OpenTimes[hiIdx];
                    sig.SwingLow = 0.0;
                    sig.ImpulseStart = sig.SwingHigh;
                    sig.ImpulseEnd = bars.LowPrices[index];
                }
            }

            return sig;
        }

    private bool ValidateMSS(global::CCTTB.MSSSignal signal, List<LiquiditySweep> sweeps)
        {
            // Optional: align with HTF bias
            var bias = _marketData.GetCurrentBias();
            bool alignedWithBias = !_config.UseTimeframeAlignment || (signal.Direction == bias);

            // Optional: require an opposite-side sweep in history
            bool hasPriorSweep = sweeps != null && sweeps.Any(s => s.Time <= signal.Time);
            bool sweepOk = !_config.RequireOppositeSweep || hasPriorSweep;

            // Mark valid using ONLY the optional toggles above (no hard extras)
            signal.IsValid = alignedWithBias && sweepOk;

            // Non-blocking score (metadata only)
            int score = 0;
            if (_config.UseScoring)
            {
                if (signal.IsValid) score += _config.Score_MSS;   // treat valid MSS as base points
                if (hasPriorSweep) score += _config.Score_Sweep;
                // You could add other tags here later (OB/OTE presence, etc.)
                if (score == 0) score = _config.Score_Default;
            }
            signal.Score = score;

            return signal.IsValid;
        }
    }
}
