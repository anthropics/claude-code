using System;

namespace CCTTB
{
    public static class Fibonacci
    {
        // --- Core ---
        public static double GetLevel(double start, double end, double level)
        {
            double range = end - start;
            return start + (range * level);
        }

        public static (double Low, double High) GetZone(double start, double end, double lowLevel, double highLevel)
        {
            var a = GetLevel(start, end, lowLevel);
            var b = GetLevel(start, end, highLevel);
            return (Math.Min(a, b), Math.Max(a, b));
        }

        public static bool IsPriceInZone(double currentPrice, double zoneLow, double zoneHigh)
        {
            double lo = Math.Min(zoneLow, zoneHigh);
            double hi = Math.Max(zoneLow, zoneHigh);
            return currentPrice >= lo && currentPrice <= hi;
        }

        public static double GetExtension(double start, double end, double extensionLevel)
        {
            // extensionLevel e.g. 1.272, 1.618
            double range = end - start;
            return end + (range * (extensionLevel - 1.0));
        }

        // --- Standard fib levels ---
        public static class Levels
        {
            public const double Fib236 = 0.236;
            public const double Fib382 = 0.382;
            public const double Fib500 = 0.500;
            public const double Fib618 = 0.618;
            public const double Fib705 = 0.705; // ICT favorite
            public const double Fib786 = 0.786;
            public const double Fib886 = 0.886;
        }

        // --- ICT OTE band ---
        public static class OTE
        {
            public const double Level618 = 0.618;
            public const double Level705 = 0.705;
            public const double Level79  = 0.790; // keep as 79% explicitly
        }

        // Return core OTE edges only (61.8% and 79%)
        public static (double OTE618, double OTE79) CalculateOTE(
            double impulseStart, double impulseEnd, bool isBullish)
        {
            double range = Math.Abs(impulseEnd - impulseStart);
            if (range <= 0) return (impulseEnd, impulseEnd);

            if (isBullish)
            {
                return (
                    impulseEnd - (range * OTE.Level618),
                    impulseEnd - (range * OTE.Level79)
                );
            }
            else
            {
                return (
                    impulseEnd + (range * OTE.Level618),
                    impulseEnd + (range * OTE.Level79)
                );
            }
        }

        // Convenience: return a sorted OTE box you can draw directly
        public static (double Low, double High) CalculateOTEZone(double impulseStart, double impulseEnd, bool isBullish)
        {
            var (l618, l79) = CalculateOTE(impulseStart, impulseEnd, isBullish);
            // Use 61.8%..79% as the OTE box (per user spec)
            double lo = Math.Min(l618, l79);
            double hi = Math.Max(l618, l79);
            return (lo, hi);
        }

        // Convenience: infer direction from start/end (end>start => bullish impulse)
        public static (double Low, double High) CalculateOTEZone(double impulseStart, double impulseEnd)
        {
            bool isBullish = impulseEnd > impulseStart;
            return CalculateOTEZone(impulseStart, impulseEnd, isBullish);
        }
    }
}
