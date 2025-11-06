using cAlgo.API;
using cAlgo.API.Internals;
using System;
using System.Collections.Generic;
using System.Linq;

namespace CCTTB
{
    public class OrderBlock
    {
        public double HighPrice { get; set; }
        public double LowPrice  { get; set; }
        public double StopPrice { get; set; }
        public BiasDirection Direction { get; set; }
        public DateTime Time { get; set; }          // OB anchor time (the opposite candle)
        public int Index { get; set; }              // OB anchor index
        public bool HasLiquidityGrab { get; set; }  // true if the OB candle swept opposite side
        public bool HasFVG { get; set; }            // optional, set elsewhere if you compute it
        public int ValidUntilIndex { get; set; }    // expiry index
    }



    public class OrderBlockDetector
    {
        private readonly StrategyConfig _config;
        private const int MAX_VALIDITY_BARS = 500;

        public OrderBlockDetector(StrategyConfig config)
        {
            _config = config;
        }

        public List<OrderBlock> DetectOrderBlocks(Bars bars, List<MSSSignal> mssSignals, List<LiquiditySweep> sweeps)
        {
            var result = new List<OrderBlock>();
            if (bars == null || bars.Count < 5) return result;

            // null-safe inputs
            mssSignals = mssSignals ?? new List<MSSSignal>();
            sweeps     = sweeps     ?? new List<LiquiditySweep>();

            // scan last N bars
            int scan = Math.Min(200, bars.Count - 1);
            int start = Math.Max(1, bars.Count - scan);

            for (int i = start; i <= bars.Count - 1; i++)
            {
                var bull = CheckBullishOrderBlock(bars, i);
                if (bull != null && ValidateOrderBlock(bull, sweeps, mssSignals, bars))
                    result.Add(bull);

                var bear = CheckBearishOrderBlock(bars, i);
                if (bear != null && ValidateOrderBlock(bear, sweeps, mssSignals, bars))
                    result.Add(bear);
            }

            // keep those still valid w.r.t. current bar index
            int lastIdx = bars.Count - 1;
            return result.Where(ob => ob.ValidUntilIndex >= lastIdx).ToList();
        }

        private OrderBlock CheckBullishOrderBlock(Bars bars, int index)
        {
            if (index <= 0 || index >= bars.Count) return null;

            int i0 = index - 1; // previous candle (down candle for bullish OB)
            if (i0 < 0) return null;

            double o0 = bars.OpenPrices[i0], c0 = bars.ClosePrices[i0], h0 = bars.HighPrices[i0], l0 = bars.LowPrices[i0];
            double o1 = bars.OpenPrices[index], c1 = bars.ClosePrices[index], h1 = bars.HighPrices[index], l1 = bars.LowPrices[index];

            bool prevBearish     = c0 < o0;
            bool currentBullish  = c1 > o1;
            bool engulfingRange  = (c1 > h0) && (l1 < l0);   // takes both sides of prev range
            bool liquidityGrab   = l1 < l0;                  // swept sell-side

            if (prevBearish && currentBullish && engulfingRange)
            {
                return new OrderBlock
                {
                    HighPrice       = h0,
                    LowPrice        = l0,
                    // often OB SL is the extreme of the OB candle; using current candle low keeps it tighter,
                    // adjust to l0 if you prefer more conservative:
                    StopPrice       = Math.Min(l0, l1),
                    Direction       = BiasDirection.Bullish,
                    Time            = bars.OpenTimes[i0],
                    Index           = i0,
                    HasLiquidityGrab= liquidityGrab,
                    ValidUntilIndex = index + MAX_VALIDITY_BARS
                };
            }
            return null;
        }

        private OrderBlock CheckBearishOrderBlock(Bars bars, int index)
        {
            if (index <= 0 || index >= bars.Count) return null;

            int i0 = index - 1; // previous candle (up candle for bearish OB)
            if (i0 < 0) return null;

            double o0 = bars.OpenPrices[i0], c0 = bars.ClosePrices[i0], h0 = bars.HighPrices[i0], l0 = bars.LowPrices[i0];
            double o1 = bars.OpenPrices[index], c1 = bars.ClosePrices[index], h1 = bars.HighPrices[index], l1 = bars.LowPrices[index];

            bool prevBullish     = c0 > o0;
            bool currentBearish  = c1 < o1;
            bool engulfingRange  = (c1 < l0) && (h1 > h0);   // takes both sides of prev range
            bool liquidityGrab   = h1 > h0;                  // swept buy-side

            if (prevBullish && currentBearish && engulfingRange)
            {
                return new OrderBlock
                {
                    HighPrice       = h0,
                    LowPrice        = l0,
                    StopPrice       = Math.Max(h0, h1),
                    Direction       = BiasDirection.Bearish,
                    Time            = bars.OpenTimes[i0],
                    Index           = i0,
                    HasLiquidityGrab= liquidityGrab,
                    ValidUntilIndex = index + MAX_VALIDITY_BARS
                };
            }
            return null;
        }

        private bool ValidateOrderBlock(OrderBlock ob, List<LiquiditySweep> sweeps, List<MSSSignal> mssSignals, Bars bars)
        {
            // MSS must agree on direction (since the OB time)
            bool hasMssSameSide = mssSignals.Any(m => m.Direction == ob.Direction && m.Time >= ob.Time);

            // Nearby sweep within 90 minutes (adjust if you want tighter)
            bool hasNearbySweep = sweeps.Any(s => Math.Abs((s.Time - ob.Time).TotalMinutes) <= 90);

            // Enforce config gates (optional features)
            if (_config.RequireMSSForEntry && !hasMssSameSide)
                return false;

            if (_config.RequireOppositeSweep && !hasNearbySweep)
                return false;

            // Baseline rule: we at least want the OB to have grabbed liquidity when it formed
            if (!ob.HasLiquidityGrab)
                return false;

            return true;
        }
    }
}
