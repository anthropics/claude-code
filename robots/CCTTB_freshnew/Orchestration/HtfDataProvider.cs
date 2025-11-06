using cAlgo.API;
using cAlgo.API.Internals;
using System;
using System.Collections.Generic;

namespace CCTTB
{
    public class HtfCandle
    {
        public double Open { get; set; }
        public double High { get; set; }
        public double Low { get; set; }
        public double Close { get; set; }
        public DateTime OpenTime { get; set; }
        public DateTime CloseTime { get; set; }
        public bool IsCompleted { get; set; }
    }

    public class HtfDataProvider
    {
        private readonly Robot _bot;
        private readonly cAlgo.API.Internals.Symbol _symbol;
        private readonly cAlgo.API.Internals.MarketData _marketData;

        private Dictionary<TimeFrame, Bars> _htfBarsCache = new Dictionary<TimeFrame, Bars>();
        private Dictionary<TimeFrame, HtfCandle> _lastCompletedCandle = new Dictionary<TimeFrame, HtfCandle>();

        public HtfDataProvider(Robot bot, cAlgo.API.Internals.Symbol symbol, cAlgo.API.Internals.MarketData marketData)
        {
            _bot = bot;
            _symbol = symbol;
            _marketData = marketData;
        }

        public Bars GetHtfBars(TimeFrame htf)
        {
            if (!_htfBarsCache.ContainsKey(htf))
            {
                // Use current API: MarketData.GetBars(TimeFrame)
                _htfBarsCache[htf] = _marketData.GetBars(htf);
            }
            return _htfBarsCache[htf];
        }

        /// <summary>
        /// Get LAST COMPLETED HTF candle (prevents repainting)
        /// Uses [-2] indexing to get completed candle ([-1] is current forming)
        /// </summary>
        public HtfCandle GetLastCompletedCandle(TimeFrame htf)
        {
            var bars = GetHtfBars(htf);
            if (bars == null || bars.Count < 2) return null;

            // Use [-2] to get LAST COMPLETED candle ([-1] is current forming)
            int idx = bars.Count - 2;

            return new HtfCandle
            {
                Open = bars.OpenPrices[idx],
                High = bars.HighPrices[idx],
                Low = bars.LowPrices[idx],
                Close = bars.ClosePrices[idx],
                OpenTime = bars.OpenTimes[idx],
                CloseTime = (idx + 1 < bars.Count)
                    ? bars.OpenTimes[idx + 1]
                    : bars.OpenTimes[idx].Add(GetCandleDuration(htf)),
                IsCompleted = true
            };
        }

        /// <summary>
        /// Get PREVIOUS COMPLETED HTF candle ([-3])
        /// </summary>
        public HtfCandle GetPreviousCompletedCandle(TimeFrame htf)
        {
            var bars = GetHtfBars(htf);
            if (bars == null || bars.Count < 3) return null;

            int idx = bars.Count - 3;

            return new HtfCandle
            {
                Open = bars.OpenPrices[idx],
                High = bars.HighPrices[idx],
                Low = bars.LowPrices[idx],
                Close = bars.ClosePrices[idx],
                OpenTime = bars.OpenTimes[idx],
                CloseTime = (idx + 1 < bars.Count)
                    ? bars.OpenTimes[idx + 1]
                    : bars.OpenTimes[idx].Add(GetCandleDuration(htf)),
                IsCompleted = true
            };
        }

        /// <summary>
        /// Check if HTF candle just completed (for event triggering)
        /// </summary>
        public bool DidHtfCandleJustComplete(TimeFrame htf)
        {
            var lastCompleted = GetLastCompletedCandle(htf);
            if (lastCompleted == null) return false;

            // Check if we have a cached version
            if (_lastCompletedCandle.ContainsKey(htf))
            {
                var cached = _lastCompletedCandle[htf];
                if (cached.OpenTime == lastCompleted.OpenTime)
                    return false; // Same candle, no new completion
            }

            // New completed candle detected
            _lastCompletedCandle[htf] = lastCompleted;
            return true;
        }

        private TimeSpan GetCandleDuration(TimeFrame htf)
        {
            if (htf == TimeFrame.Minute) return TimeSpan.FromMinutes(1);
            if (htf == TimeFrame.Minute5) return TimeSpan.FromMinutes(5);
            if (htf == TimeFrame.Minute15) return TimeSpan.FromMinutes(15);
            if (htf == TimeFrame.Hour) return TimeSpan.FromHours(1);
            if (htf == TimeFrame.Hour4) return TimeSpan.FromHours(4);
            if (htf == TimeFrame.Daily) return TimeSpan.FromDays(1);
            if (htf == TimeFrame.Weekly) return TimeSpan.FromDays(7);
            return TimeSpan.FromMinutes(5); // Default fallback
        }
    }
}
