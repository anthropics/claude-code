using System;
using cAlgo.API;
using cAlgo.API.Internals;

namespace CCTTB
{
    // ═══════════════════════════════════════════════════════════════════════════════
    // ADVANCED FEATURE: PATTERN RECOGNITION - Candlestick Patterns + Volume Analysis
    // ═══════════════════════════════════════════════════════════════════════════════

    public enum CandlePattern
    {
        None,
        Engulfing,          // Strong reversal signal
        Doji,               // Indecision
        Hammer,             // Bullish reversal
        ShootingStar,       // Bearish reversal
        MorningStar,        // 3-bar bullish reversal
        EveningStar,        // 3-bar bearish reversal
        Pinbar              // Rejection candle
    }

    public class PatternRecognition
    {
        private readonly double _dojiThreshold = 0.1;      // Body < 10% of range = doji
        private readonly double _pinbarThreshold = 0.33;   // Body < 33% of range = pinbar

        public CandlePattern DetectPattern(Bars bars, int index)
        {
            if (bars == null || index < 2 || index >= bars.Count)
                return CandlePattern.None;

            // Get candle data
            double open0 = bars.OpenPrices[index];
            double high0 = bars.HighPrices[index];
            double low0 = bars.LowPrices[index];
            double close0 = bars.ClosePrices[index];

            double open1 = bars.OpenPrices[index - 1];
            double high1 = bars.HighPrices[index - 1];
            double low1 = bars.LowPrices[index - 1];
            double close1 = bars.ClosePrices[index - 1];

            double body0 = Math.Abs(close0 - open0);
            double range0 = high0 - low0;
            double body1 = Math.Abs(close1 - open1);
            double range1 = high1 - low1;

            // Avoid division by zero
            if (range0 < 1e-8 || range1 < 1e-8)
                return CandlePattern.None;

            // 1. ENGULFING PATTERN
            if (body0 > body1 * 1.5) // Current body is 50% larger
            {
                bool bullishEngulf = close0 > open0 && close1 < open1 && // Bullish candle after bearish
                                     open0 <= close1 && close0 >= open1;   // Fully engulfs previous

                bool bearishEngulf = close0 < open0 && close1 > open1 && // Bearish candle after bullish
                                     open0 >= close1 && close0 <= open1;   // Fully engulfs previous

                if (bullishEngulf || bearishEngulf)
                    return CandlePattern.Engulfing;
            }

            // 2. DOJI PATTERN (Indecision)
            if (body0 / range0 < _dojiThreshold)
            {
                return CandlePattern.Doji;
            }

            // 3. HAMMER PATTERN (Bullish reversal)
            double lowerWick0 = Math.Min(open0, close0) - low0;
            double upperWick0 = high0 - Math.Max(open0, close0);

            if (lowerWick0 > body0 * 2 && upperWick0 < body0 * 0.5) // Long lower wick, small upper
            {
                return CandlePattern.Hammer;
            }

            // 4. SHOOTING STAR PATTERN (Bearish reversal)
            if (upperWick0 > body0 * 2 && lowerWick0 < body0 * 0.5) // Long upper wick, small lower
            {
                return CandlePattern.ShootingStar;
            }

            // 5. PINBAR PATTERN (Rejection)
            if (body0 / range0 < _pinbarThreshold)
            {
                if (lowerWick0 > range0 * 0.6 || upperWick0 > range0 * 0.6)
                {
                    return CandlePattern.Pinbar;
                }
            }

            // 6. MORNING STAR / EVENING STAR (3-bar patterns)
            if (index >= 2)
            {
                double open2 = bars.OpenPrices[index - 2];
                double close2 = bars.ClosePrices[index - 2];
                double body2 = Math.Abs(close2 - open2);

                // Morning Star: Bearish → Small → Bullish
                bool morningStar = close2 < open2 &&           // Bar 2 bearish
                                   body1 < body2 * 0.3 &&      // Bar 1 small
                                   close0 > open0 &&           // Bar 0 bullish
                                   close0 > (open2 + close2) / 2;  // Closes above midpoint

                // Evening Star: Bullish → Small → Bearish
                bool eveningStar = close2 > open2 &&           // Bar 2 bullish
                                   body1 < body2 * 0.3 &&      // Bar 1 small
                                   close0 < open0 &&           // Bar 0 bearish
                                   close0 < (open2 + close2) / 2;  // Closes below midpoint

                if (morningStar)
                    return CandlePattern.MorningStar;
                if (eveningStar)
                    return CandlePattern.EveningStar;
            }

            return CandlePattern.None;
        }

        // Volume analysis: Detect volume spikes
        public bool IsVolumeSpike(Bars bars, int index, double threshold = 1.5)
        {
            if (bars == null || index < 20 || index >= bars.Count)
                return false;

            try
            {
                double currentVolume = (double)bars.TickVolumes[index];

                // Calculate average volume over last 20 bars
                double volumeSum = 0;
                for (int i = index - 20; i < index; i++)
                {
                    volumeSum += (double)bars.TickVolumes[i];
                }
                double avgVolume = volumeSum / 20.0;

                // Volume spike if current > threshold * average
                return currentVolume > avgVolume * threshold;
            }
            catch
            {
                return false;
            }
        }

        // Get pattern strength (0.0-1.0)
        public double GetPatternStrength(CandlePattern pattern, Bars bars, int index)
        {
            if (pattern == CandlePattern.None)
                return 0.0;

            // Base strengths by pattern type
            double baseStrength = pattern switch
            {
                CandlePattern.Engulfing => 0.8,      // Strong reversal
                CandlePattern.MorningStar => 0.75,   // Strong 3-bar reversal
                CandlePattern.EveningStar => 0.75,   // Strong 3-bar reversal
                CandlePattern.Hammer => 0.65,        // Moderate reversal
                CandlePattern.ShootingStar => 0.65,  // Moderate reversal
                CandlePattern.Pinbar => 0.60,        // Rejection signal
                CandlePattern.Doji => 0.40,          // Indecision (weak)
                _ => 0.5
            };

            // Boost if accompanied by volume spike
            bool volumeConfirm = IsVolumeSpike(bars, index, 1.5);
            if (volumeConfirm)
                baseStrength = Math.Min(1.0, baseStrength + 0.15);

            return baseStrength;
        }

        // Check if pattern confirms entry direction
        public bool PatternConfirmsDirection(CandlePattern pattern, BiasDirection direction)
        {
            if (pattern == CandlePattern.None)
                return false;

            if (direction == BiasDirection.Bullish)
            {
                return pattern == CandlePattern.Engulfing ||
                       pattern == CandlePattern.Hammer ||
                       pattern == CandlePattern.MorningStar ||
                       (pattern == CandlePattern.Pinbar); // Pinbar can be bullish if rejection from below
            }
            else if (direction == BiasDirection.Bearish)
            {
                return pattern == CandlePattern.Engulfing ||
                       pattern == CandlePattern.ShootingStar ||
                       pattern == CandlePattern.EveningStar ||
                       (pattern == CandlePattern.Pinbar); // Pinbar can be bearish if rejection from above
            }

            return false;
        }
    }
}
