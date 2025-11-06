using System;
using System.Collections.Generic;

namespace CCTTB.MSS.Core.Detectors
{
    public static class SwingDetector
    {
        private static bool Valid(IList<double> xs) => xs != null && xs.Count > 2;

        /// <summary>
        /// True if highs[i] is greater than highs of the previous/next `pivot` bars.
        /// </summary>
        public static bool IsSwingHigh(IList<double> highs, int i, int pivot = 1, bool strict = true)
        {
            if (!Valid(highs) || pivot < 1) return false;
            if (i < pivot || i + pivot >= highs.Count) return false;

            for (int k = 1; k <= pivot; k++)
            {
                if (strict)
                {
                    if (highs[i] <= highs[i - k] || highs[i] <= highs[i + k]) return false;
                }
                else
                {
                    if (highs[i] < highs[i - k] || highs[i] < highs[i + k]) return false;
                }
            }
            return true;
        }

        /// <summary>
        /// True if lows[i] is lower than lows of the previous/next `pivot` bars.
        /// </summary>
        public static bool IsSwingLow(IList<double> lows, int i, int pivot = 1, bool strict = true)
        {
            if (!Valid(lows) || pivot < 1) return false;
            if (i < pivot || i + pivot >= lows.Count) return false;

            for (int k = 1; k <= pivot; k++)
            {
                if (strict)
                {
                    if (lows[i] >= lows[i - k] || lows[i] >= lows[i + k]) return false;
                }
                else
                {
                    if (lows[i] > lows[i - k] || lows[i] > lows[i + k]) return false;
                }
            }
            return true;
        }

        /// <summary>
        /// Finds the last swing high strictly before index `i`.
        /// </summary>
        public static int LastSwingHighBefore(IList<double> highs, int i, int pivot = 1, bool strict = true)
        {
            if (!Valid(highs) || pivot < 1) return -1;
            int start = Math.Min(i - 1, highs.Count - 1 - pivot);
            for (int k = start; k >= pivot; k--)
                if (IsSwingHigh(highs, k, pivot, strict)) return k;
            return -1;
        }

        /// <summary>
        /// Finds the last swing low strictly before index `i`.
        /// </summary>
        public static int LastSwingLowBefore(IList<double> lows, int i, int pivot = 1, bool strict = true)
        {
            if (!Valid(lows) || pivot < 1) return -1;
            int start = Math.Min(i - 1, lows.Count - 1 - pivot);
            for (int k = start; k >= pivot; k--)
                if (IsSwingLow(lows, k, pivot, strict)) return k;
            return -1;
        }
    }
}
