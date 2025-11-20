using cAlgo.API;
using System;

namespace CCTTB
{
    /// <summary>
    /// Manages multi-timeframe cascade for liquidity sweep -> MSS -> entry workflow
    /// Chart TF = Liquidity detection
    /// Lower TF = MSS detection and entry signals (OTE/OB)
    /// </summary>
    public static class TimeframeCascade
    {
        /// <summary>
        /// Get the lower timeframe to use for MSS detection based on chart timeframe
        /// </summary>
        public static TimeFrame GetMSSTimeframe(TimeFrame chartTimeframe)
        {
            // H4 → M15
            if (chartTimeframe == TimeFrame.Hour4)
                return TimeFrame.Minute15;

            // H1 → M15
            if (chartTimeframe == TimeFrame.Hour)
                return TimeFrame.Minute15;

            // M15 → M5
            if (chartTimeframe == TimeFrame.Minute15)
                return TimeFrame.Minute5;

            // M5 → M1
            if (chartTimeframe == TimeFrame.Minute5)
                return TimeFrame.Minute;

            // M1 → M1 (no lower timeframe available)
            if (chartTimeframe == TimeFrame.Minute)
                return TimeFrame.Minute;

            // Default: use one step lower or same if not supported
            return chartTimeframe;
        }

        /// <summary>
        /// Check if multi-timeframe cascade is supported for this chart timeframe
        /// </summary>
        public static bool IsCascadeSupported(TimeFrame chartTimeframe)
        {
            return chartTimeframe == TimeFrame.Hour4 ||
                   chartTimeframe == TimeFrame.Hour ||
                   chartTimeframe == TimeFrame.Minute15 ||
                   chartTimeframe == TimeFrame.Minute5;
        }

        /// <summary>
        /// Get human-readable description of the cascade
        /// </summary>
        public static string GetCascadeDescription(TimeFrame chartTimeframe)
        {
            var mssTf = GetMSSTimeframe(chartTimeframe);
            return $"{GetTimeframeName(chartTimeframe)} liquidity → {GetTimeframeName(mssTf)} MSS";
        }

        private static string GetTimeframeName(TimeFrame tf)
        {
            if (tf == TimeFrame.Hour4) return "H4";
            if (tf == TimeFrame.Hour) return "H1";
            if (tf == TimeFrame.Minute15) return "M15";
            if (tf == TimeFrame.Minute5) return "M5";
            if (tf == TimeFrame.Minute) return "M1";
            return tf.ToString();
        }
    }
}
