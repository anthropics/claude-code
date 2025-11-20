// File: Signals_LiquiditySweepDetector.cs
using System;
using System.Collections.Generic;
using cAlgo.API;  // <-- brings in Bars (cAlgo.API.Bars)

namespace CCTTB
{
    public class LiquiditySweep
    {
        public DateTime Time { get; set; }
        public double   Price { get; set; }
        public bool     IsBullish { get; set; }
        public string   Label { get; set; }
        public LiquidityZoneType ZoneType { get; set; }
        public double   SweepCandleHigh { get; set; }  // High of candle that swept liquidity
        public double   SweepCandleLow { get; set; }   // Low of candle that swept liquidity
    }

    public class LiquiditySweepDetector
    {
        private readonly StrategyConfig _config;
        private SweepBufferCalculator _sweepBuffer;

        public LiquiditySweepDetector(StrategyConfig config) { _config = config; }

        // Wire in the ATR-based sweep buffer calculator
        public void SetSweepBuffer(SweepBufferCalculator sweepBuffer)
        {
            _sweepBuffer = sweepBuffer;
        }

        public List<LiquiditySweep> DetectSweeps(DateTime serverTime, Bars bars, List<LiquidityZone> zones)
        {
            var results = new List<LiquiditySweep>();
            if (bars == null || bars.Count < 3 || zones == null || zones.Count == 0)
                return results;

            int start = Math.Max(1, bars.Count - 50);
            int end   = bars.Count - 1;

            for (int i = start; i <= end; i++)
            {
                double open  = bars.OpenPrices[i];
                double close = bars.ClosePrices[i];
                double high  = bars.HighPrices[i];
                double low   = bars.LowPrices[i];
                DateTime t   = bars.OpenTimes[i];

                foreach (var z in zones)
                {
                    // Get ATR-based buffer if available, otherwise use 0 (exact level)
                    double buffer = (_sweepBuffer != null) ? _sweepBuffer.CalculateBuffer() : 0;

                    if (z.Type == LiquidityZoneType.Demand)
                    {
                        // Demand sweep: low must pierce below level - buffer, close must recover above level
                        bool pierced  = low < (z.Low - buffer);
                        bool reverted = close >= z.Low;
                        if (pierced && reverted)
                        {
                            results.Add(new LiquiditySweep
                            {
                                Time = t,
                                Price = z.Low,
                                IsBullish = true,
                                Label = string.IsNullOrWhiteSpace(z.Label) ? "Demand Sweep" : z.Label,
                                ZoneType = z.Type,
                                SweepCandleHigh = high,
                                SweepCandleLow = low
                            });
                        }
                    }
                    else // Supply
                    {
                        // Supply sweep: high must pierce above level + buffer, close must recover below level
                        bool pierced  = high > (z.High + buffer);
                        bool reverted = close <= z.High;
                        if (pierced && reverted)
                        {
                            results.Add(new LiquiditySweep
                            {
                                Time = t,
                                Price = z.High,
                                IsBullish = false,
                                Label = string.IsNullOrWhiteSpace(z.Label) ? "Supply Sweep" : z.Label,
                                ZoneType = z.Type,
                                SweepCandleHigh = high,
                                SweepCandleLow = low
                            });
                        }
                    }
                }
            }

            const int maxKeep = 20;
            if (results.Count > maxKeep)
                results.RemoveRange(0, results.Count - maxKeep);

            return results;
        }
    }
}
