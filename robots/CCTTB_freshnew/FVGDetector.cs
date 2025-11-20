using System.Collections.Generic;

namespace CCTTB.MSS.Core.Detectors
{
    public static class FVGDetector
    {
        // Basic validation for lists and index
        private static bool Valid(IList<double> highs, IList<double> lows, int i)
        {
            if (highs == null || lows == null) return false;
            if (highs.Count != lows.Count) return false;
            if (i < 1 || i + 1 >= highs.Count) return false; // need A=i-1 and C=i+1
            return true;
        }

        /// <summary>
        /// Bullish FVG: C.low > A.high (optionally by at least minGap)
        /// </summary>
        public static bool HasBullishFVG(IList<double> highs, IList<double> lows, int i, double minGap = 0.0)
        {
            if (!Valid(highs, lows, i)) return false;
            double aHigh = highs[i - 1];
            double cLow  = lows[i + 1];
            return (cLow - aHigh) > minGap;
        }

        /// <summary>
        /// Bearish FVG: C.high < A.low (optionally by at least minGap)
        /// </summary>
        public static bool HasBearishFVG(IList<double> highs, IList<double> lows, int i, double minGap = 0.0)
        {
            if (!Valid(highs, lows, i)) return false;
            double cHigh = highs[i + 1];
            double aLow  = lows[i - 1];
            return (aLow - cHigh) > minGap;
        }

        /// <summary>
        /// Bounds for bullish FVG: [A.high .. C.low]
        /// </summary>
        public static (double low, double high)? GapBoundsBullish(IList<double> highs, IList<double> lows, int i, double minGap = 0.0)
        {
            if (!HasBullishFVG(highs, lows, i, minGap)) return null;
            double low  = highs[i - 1]; // A.high
            double high = lows[i + 1];  // C.low
            return (low, high);
        }

        /// <summary>
        /// Bounds for bearish FVG: [C.high .. A.low]
        /// </summary>
        public static (double low, double high)? GapBoundsBearish(IList<double> highs, IList<double> lows, int i, double minGap = 0.0)
        {
            if (!HasBearishFVG(highs, lows, i, minGap)) return null;
            double low  = highs[i + 1]; // C.high
            double high = lows[i - 1];  // A.low
            return (low, high);
        }
    }
}
