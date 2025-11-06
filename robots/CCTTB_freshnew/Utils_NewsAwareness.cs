using System;
using System.Collections.Generic;
using System.Linq;
using cAlgo.API;
using cAlgo.API.Indicators;

namespace CCTTB
{
    /// <summary>
    /// ADVANCED FEATURE: News & Event Awareness
    /// Detects high-volatility periods likely caused by news events and adjusts trading behavior.
    /// Note: cTrader doesn't have built-in economic calendar, so we use volatility detection
    /// combined with manual blackout windows for known high-impact news.
    /// </summary>
    public enum NewsEnvironment
    {
        PreNews,       // Elevated volatility detected, possible news coming
        PostNews,      // Recent spike in volatility, likely post-news
        Normal,        // Normal market conditions
        HighVolatility // Sustained high volatility (uncertain cause)
    }

    public class NewsAwareness
    {
        private readonly Robot _robot;
        private readonly bool _enableDebugLogging;
        private AverageTrueRange _atr;
        private readonly double _volatilityThreshold = 1.5;  // ATR spike threshold (1.5× average)
        private readonly int _atrLookback = 20;  // Compare current ATR to recent average

        // Track recent volatility spikes
        private readonly List<DateTime> _recentVolatilitySpikes = new List<DateTime>();
        private readonly TimeSpan _postNewsDuration = TimeSpan.FromHours(2);  // 2 hours post-news window

        // Manual blackout windows (from config parameter)
        private List<TimeSpan[]> _manualBlackoutWindows;

        public NewsAwareness(Robot robot, AverageTrueRange atr, string manualBlackouts, bool enableDebugLogging = false)
        {
            _robot = robot;
            _atr = atr;
            _enableDebugLogging = enableDebugLogging;
            _manualBlackoutWindows = ParseBlackoutWindows(manualBlackouts);

            if (_enableDebugLogging && _manualBlackoutWindows.Count > 0)
            {
                _robot.Print($"[NEWS AWARENESS] Configured {_manualBlackoutWindows.Count} manual blackout windows");
            }
        }

        /// <summary>
        /// Parse blackout windows from config string
        /// Format: "08:30-09:30,13:00-14:00" (UTC times)
        /// </summary>
        private List<TimeSpan[]> ParseBlackoutWindows(string blackouts)
        {
            var windows = new List<TimeSpan[]>();
            if (string.IsNullOrWhiteSpace(blackouts)) return windows;

            try
            {
                string[] pairs = blackouts.Split(new[] { ',', ';' }, StringSplitOptions.RemoveEmptyEntries);
                foreach (string pair in pairs)
                {
                    string[] times = pair.Split('-');
                    if (times.Length == 2)
                    {
                        TimeSpan start = TimeSpan.Parse(times[0].Trim());
                        TimeSpan end = TimeSpan.Parse(times[1].Trim());
                        windows.Add(new[] { start, end });
                    }
                }
            }
            catch (Exception ex)
            {
                _robot.Print($"[NEWS AWARENESS] ERROR parsing blackout windows: {ex.Message}");
            }

            return windows;
        }

        /// <summary>
        /// Determine current news environment based on volatility and time
        /// </summary>
        public NewsEnvironment GetNewsEnvironment()
        {
            DateTime now = _robot.Server.Time;

            // Check manual blackout windows first
            TimeSpan currentTime = now.TimeOfDay;
            foreach (var window in _manualBlackoutWindows)
            {
                if (IsTimeInWindow(currentTime, window[0], window[1]))
                {
                    return NewsEnvironment.PreNews;  // In blackout window
                }
            }

            // Check for recent volatility spikes (post-news)
            CleanOldSpikes(now);
            if (_recentVolatilitySpikes.Any(spike => now - spike < _postNewsDuration))
            {
                return NewsEnvironment.PostNews;
            }

            // Check current ATR vs recent average
            if (_atr != null && _atr.Result.Count > _atrLookback + 1)
            {
                double currentATR = _atr.Result.LastValue;
                double averageATR = 0;

                // Calculate average ATR over lookback period
                for (int i = 1; i <= _atrLookback; i++)
                {
                    averageATR += _atr.Result.Last(i);
                }
                averageATR /= _atrLookback;

                if (averageATR > 0)
                {
                    double atrRatio = currentATR / averageATR;

                    if (atrRatio > _volatilityThreshold)
                    {
                        // Spike detected - record it
                        if (!_recentVolatilitySpikes.Any(s => now - s < TimeSpan.FromMinutes(30)))
                        {
                            _recentVolatilitySpikes.Add(now);
                            if (_enableDebugLogging)
                                _robot.Print($"[NEWS AWARENESS] Volatility spike detected! ATR ratio: {atrRatio:F2}");
                        }

                        return NewsEnvironment.HighVolatility;
                    }
                }
            }

            return NewsEnvironment.Normal;
        }

        /// <summary>
        /// Get risk multiplier based on news environment
        /// PreNews: 0.5× (reduce risk before news)
        /// PostNews: 0.7× (cautious after news, but opportunities exist)
        /// HighVolatility: 0.6× (reduce risk in volatile conditions)
        /// Normal: 1.0× (standard risk)
        /// </summary>
        public double GetNewsRiskMultiplier()
        {
            NewsEnvironment env = GetNewsEnvironment();

            switch (env)
            {
                case NewsEnvironment.PreNews:
                    return 0.5;  // Cut risk in half before news

                case NewsEnvironment.PostNews:
                    return 0.7;  // Slightly reduced risk post-news

                case NewsEnvironment.HighVolatility:
                    return 0.6;  // Reduced risk in volatile markets

                case NewsEnvironment.Normal:
                default:
                    return 1.0;  // Normal risk
            }
        }

        /// <summary>
        /// Check if post-news continuation is likely (volatility returning to normal after spike)
        /// This is a good time to enter trades as the trend resumes
        /// </summary>
        public bool IsPostNewsContinuation()
        {
            DateTime now = _robot.Server.Time;

            // Must be in post-news window
            CleanOldSpikes(now);
            if (!_recentVolatilitySpikes.Any(spike => now - spike < _postNewsDuration))
                return false;

            // Volatility should be returning to normal (not high anymore)
            if (_atr != null && _atr.Result.Count > _atrLookback + 1)
            {
                double currentATR = _atr.Result.LastValue;
                double averageATR = 0;

                for (int i = 1; i <= _atrLookback; i++)
                {
                    averageATR += _atr.Result.Last(i);
                }
                averageATR /= _atrLookback;

                if (averageATR > 0)
                {
                    double atrRatio = currentATR / averageATR;

                    // ATR should be elevated but not extreme (1.1-1.4× normal)
                    // This suggests volatility is normalizing after the spike
                    if (atrRatio >= 1.1 && atrRatio <= 1.4)
                    {
                        return true;
                    }
                }
            }

            return false;
        }

        /// <summary>
        /// Get confidence adjustment for news environment
        /// Returns 0.8-1.2 multiplier based on news conditions
        /// </summary>
        public double GetNewsConfidenceFactor()
        {
            NewsEnvironment env = GetNewsEnvironment();

            switch (env)
            {
                case NewsEnvironment.PreNews:
                    return 0.8;  // Reduce confidence before news (uncertain price action)

                case NewsEnvironment.PostNews:
                    // Post-news can be good if it's a continuation setup
                    if (IsPostNewsContinuation())
                        return 1.2;  // Boost confidence for post-news continuation
                    else
                        return 0.9;  // Slight reduction if volatility still high

                case NewsEnvironment.HighVolatility:
                    return 0.85;  // Reduce confidence in high volatility

                case NewsEnvironment.Normal:
                default:
                    return 1.0;  // No adjustment
            }
        }

        /// <summary>
        /// Check if currently in a news blackout window
        /// </summary>
        public bool IsInNewsBlackout()
        {
            NewsEnvironment env = GetNewsEnvironment();
            return env == NewsEnvironment.PreNews;
        }

        /// <summary>
        /// Get diagnostic string for current news environment
        /// </summary>
        public string GetDiagnosticString()
        {
            NewsEnvironment env = GetNewsEnvironment();
            double riskMult = GetNewsRiskMultiplier();
            double confidenceFactor = GetNewsConfidenceFactor();
            bool continuation = IsPostNewsContinuation();

            string envText = env == NewsEnvironment.PreNews ? "PRE-NEWS (blackout window)" :
                            env == NewsEnvironment.PostNews ? "POST-NEWS" :
                            env == NewsEnvironment.HighVolatility ? "HIGH VOLATILITY" :
                            "NORMAL";

            return $"{envText} | Risk: {riskMult:F2}× | Confidence: {confidenceFactor:F2}× | Continuation: {continuation}";
        }

        /// <summary>
        /// Helper: Check if time falls within a window
        /// </summary>
        private bool IsTimeInWindow(TimeSpan time, TimeSpan start, TimeSpan end)
        {
            if (start <= end)
            {
                // Normal window (e.g., 08:00-10:00)
                return time >= start && time <= end;
            }
            else
            {
                // Overnight window (e.g., 22:00-02:00)
                return time >= start || time <= end;
            }
        }

        /// <summary>
        /// Remove old volatility spikes from tracking list
        /// </summary>
        private void CleanOldSpikes(DateTime now)
        {
            _recentVolatilitySpikes.RemoveAll(spike => now - spike > TimeSpan.FromHours(4));
        }
    }
}
