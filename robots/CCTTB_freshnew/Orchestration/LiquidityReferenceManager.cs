using cAlgo.API;
using cAlgo.API.Internals;
using System;
using System.Collections.Generic;

namespace CCTTB
{
    public class LiquidityReference
    {
        public string Label { get; set; }          // "PDH", "Asia_H", "4H_H", etc.
        public double Level { get; set; }          // Price level
        public string Type { get; set; }           // "Supply" or "Demand"
        public TimeFrame SourceHtf { get; set; }  // TimeFrame for HTF levels
        public DateTime ComputedAt { get; set; }
    }

    public class LiquidityReferenceManager
    {
        private readonly Robot _bot;
        private readonly cAlgo.API.Internals.Symbol _symbol;
        private readonly HtfDataProvider _htfData;
        private readonly HtfMapper _htfMapper;

        public LiquidityReferenceManager(Robot bot, cAlgo.API.Internals.Symbol symbol, HtfDataProvider htfData, HtfMapper htfMapper)
        {
            _bot = bot;
            _symbol = symbol;
            _htfData = htfData;
            _htfMapper = htfMapper;
        }

        public List<LiquidityReference> ComputeAllReferences(TimeFrame htfPrimary, TimeFrame htfSecondary)
        {
            var refs = new List<LiquidityReference>();
            var now = _bot.Server.Time;

            // 1. PDH/PDL (Previous Day High/Low)
            var pdh = ComputePDH();
            var pdl = ComputePDL();
            if (pdh > 0) refs.Add(new LiquidityReference { Label = "PDH", Level = pdh, Type = "Supply", ComputedAt = now });
            if (pdl > 0) refs.Add(new LiquidityReference { Label = "PDL", Level = pdl, Type = "Demand", ComputedAt = now });

            // 2. Asia Session H/L
            var asiaH = ComputeAsiaHigh();
            var asiaL = ComputeAsiaLow();
            if (asiaH > 0) refs.Add(new LiquidityReference { Label = "Asia_H", Level = asiaH, Type = "Supply", ComputedAt = now });
            if (asiaL > 0) refs.Add(new LiquidityReference { Label = "Asia_L", Level = asiaL, Type = "Demand", ComputedAt = now });

            // 3. HTF Primary (current + previous)
            AddHtfReferences(refs, htfPrimary, now);

            // 4. HTF Secondary (current + previous)
            AddHtfReferences(refs, htfSecondary, now);

            return refs;
        }

        private void AddHtfReferences(List<LiquidityReference> refs, TimeFrame htf, DateTime now)
        {
            var htfLabel = _htfMapper.GetHtfLabel(htf);

            var htfCurrent = _htfData.GetLastCompletedCandle(htf);
            var htfPrev = _htfData.GetPreviousCompletedCandle(htf);

            if (htfCurrent != null)
            {
                refs.Add(new LiquidityReference
                {
                    Label = $"{htfLabel}_H",
                    Level = htfCurrent.High,
                    Type = "Supply",
                    SourceHtf = htf,
                    ComputedAt = now
                });
                refs.Add(new LiquidityReference
                {
                    Label = $"{htfLabel}_L",
                    Level = htfCurrent.Low,
                    Type = "Demand",
                    SourceHtf = htf,
                    ComputedAt = now
                });
            }

            if (htfPrev != null)
            {
                refs.Add(new LiquidityReference
                {
                    Label = $"Prev_{htfLabel}_H",
                    Level = htfPrev.High,
                    Type = "Supply",
                    SourceHtf = htf,
                    ComputedAt = now
                });
                refs.Add(new LiquidityReference
                {
                    Label = $"Prev_{htfLabel}_L",
                    Level = htfPrev.Low,
                    Type = "Demand",
                    SourceHtf = htf,
                    ComputedAt = now
                });
            }
        }

        private double ComputePDH()
        {
            // Get daily bars
            var dailyBars = _htfData.GetHtfBars(TimeFrame.Daily);
            if (dailyBars == null || dailyBars.Count < 2) return 0;

            // Previous day (completed) = [-2]
            return dailyBars.HighPrices[dailyBars.Count - 2];
        }

        private double ComputePDL()
        {
            var dailyBars = _htfData.GetHtfBars(TimeFrame.Daily);
            if (dailyBars == null || dailyBars.Count < 2) return 0;
            return dailyBars.LowPrices[dailyBars.Count - 2];
        }

        private double ComputeAsiaHigh()
        {
            // Asia session: 00:00-09:00 UTC
            // Scan last 24 hours of chart bars, find high in Asia window
            var bars = _bot.Bars;
            if (bars == null || bars.Count < 100) return 0;

            double maxHigh = 0;
            int lookback = Math.Min(bars.Count, 288); // 288 bars = 24h at M5

            for (int i = bars.Count - 1; i >= bars.Count - lookback; i--)
            {
                var time = bars.OpenTimes[i];
                if (time.Hour >= 0 && time.Hour < 9) // Asia window
                {
                    maxHigh = Math.Max(maxHigh, bars.HighPrices[i]);
                }
            }
            return maxHigh;
        }

        private double ComputeAsiaLow()
        {
            var bars = _bot.Bars;
            if (bars == null || bars.Count < 100) return double.MaxValue;

            double minLow = double.MaxValue;
            int lookback = Math.Min(bars.Count, 288);

            for (int i = bars.Count - 1; i >= bars.Count - lookback; i--)
            {
                var time = bars.OpenTimes[i];
                if (time.Hour >= 0 && time.Hour < 9)
                {
                    minLow = Math.Min(minLow, bars.LowPrices[i]);
                }
            }
            return minLow == double.MaxValue ? 0 : minLow;
        }
    }
}
