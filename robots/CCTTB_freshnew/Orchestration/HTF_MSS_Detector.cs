using cAlgo.API;
using cAlgo.API.Internals;
using System;
using System.Collections.Generic;
using System.Linq;

namespace CCTTB
{
    /// <summary>
    /// HTF MSS DETECTOR (15M) - Detects higher timeframe Market Structure Shifts
    /// Emits HTF_MSS events: side, htfPOI, sweepRef, displacement, structBreak, validUntil
    /// Part of MSS Orchestrator dual-timeframe system (15M bias → 5M entry)
    /// </summary>
    public class HTF_MSS_Detector
    {
        private readonly Robot _bot;
        private readonly Symbol _symbol;
        private readonly LiquiditySweepDetector _sweepDetector;
        private readonly MSSignalDetector _mssDetector;
        private readonly MarketDataProvider _marketData;

        // Configuration
        private readonly TimeFrame _htfTimeframe = TimeFrame.Minute15;
        private readonly int _minStructBreakPips = 10;
        private readonly int _windowCandles = 20; // 5 hours on 15M

        // State tracking
        private DateTime _lastSweepTime = DateTime.MinValue;
        private double _lastSweepLevel = 0;
        private DateTime _lastMSSTime = DateTime.MinValue;

        public HTF_MSS_Detector(Robot bot, Symbol symbol, LiquiditySweepDetector sweepDetector,
            MSSignalDetector mssDetector, MarketDataProvider marketData)
        {
            _bot = bot;
            _symbol = symbol;
            _sweepDetector = sweepDetector;
            _mssDetector = mssDetector;
            _marketData = marketData;
        }

        /// <summary>
        /// DETECT HTF MSS - Main detection logic called on 15M bar close
        /// </summary>
        public HTF_MSSEvent DetectHTF_MSS()
        {
            try
            {
                var htfBars = _bot.MarketData.GetBars(_htfTimeframe, _symbol.Name);
                if (htfBars.Count < 50) return null;

                int idx = htfBars.Count - 2; // Last completed candle
                if (idx < 2) return null;

                // Step 1: Check for recent liquidity sweep (within last 10 candles)
                var sweepInfo = CheckForRecentSweep(htfBars, idx);
                if (sweepInfo == null)
                {
                    _bot.Print("[HTF_MSS] No recent sweep detected on 15M");
                    return null;
                }

                // Step 2: Detect MSS with displacement
                var mssInfo = DetectMSSWithDisplacement(htfBars, idx, sweepInfo.Direction);
                if (mssInfo == null)
                {
                    _bot.Print($"[HTF_MSS] No MSS detected after {sweepInfo.Direction} sweep");
                    return null;
                }

                // Step 3: Validate structure break
                var structBreak = ValidateStructureBreak(htfBars, idx, mssInfo.Side);
                if (structBreak == null)
                {
                    _bot.Print("[HTF_MSS] Structure break validation failed");
                    return null;
                }

                // Step 4: Identify HTF POI (Order Block or FVG)
                var htfPOI = IdentifyHTF_POI(htfBars, idx, mssInfo.Side);
                if (htfPOI == null)
                {
                    _bot.Print("[HTF_MSS] No HTF POI identified");
                    return null;
                }

                // Step 5: Calculate displacement metrics
                var displacement = CalculateDisplacement(htfBars, idx, mssInfo);

                // Step 6: Create HTF_MSS event
                var htfEvent = new HTF_MSSEvent
                {
                    Side = mssInfo.Side,
                    HTFPOI = htfPOI,
                    SweepRef = sweepInfo.Reference,
                    Displacement = displacement,
                    StructBreak = structBreak,
                    ValidUntil = htfBars.OpenTimes[idx].AddMinutes(_windowCandles * 15),
                    DetectedAt = htfBars.OpenTimes[idx],
                    HTFTimeframe = _htfTimeframe
                };

                _lastMSSTime = htfBars.OpenTimes[idx];

                _bot.Print($"[HTF_MSS] ✅ {mssInfo.Side} MSS detected on 15M | POI: {htfPOI.PriceTop:F5}-{htfPOI.PriceBottom:F5} | Displacement: {displacement.ATRz:F2}x ATR | Valid until: {htfEvent.ValidUntil:HH:mm}");

                return htfEvent;
            }
            catch (Exception ex)
            {
                _bot.Print($"[HTF_MSS] ERROR: {ex.Message}");
                return null;
            }
        }

        /// <summary>
        /// CHECK FOR RECENT SWEEP - Looks for liquidity sweep in last 10 candles
        /// </summary>
        private SweepInfo CheckForRecentSweep(Bars bars, int currentIdx)
        {
            int lookback = Math.Min(10, currentIdx);

            for (int i = currentIdx; i > currentIdx - lookback; i--)
            {
                var sweepTime = bars.OpenTimes[i];

                // Check if sweep already processed
                if (sweepTime == _lastSweepTime)
                    continue;

                // Get recent swing high/low
                double swingHigh = bars.HighPrices.Skip(Math.Max(0, i - 20)).Take(19).Max();
                double swingLow = bars.LowPrices.Skip(Math.Max(0, i - 20)).Take(19).Min();

                double high = bars.HighPrices[i];
                double low = bars.LowPrices[i];
                double close = bars.ClosePrices[i];

                // Sweep up (manipulation)
                if (high > swingHigh && close < swingHigh)
                {
                    _lastSweepTime = sweepTime;
                    _lastSweepLevel = swingHigh;

                    return new SweepInfo
                    {
                        Direction = "Up",
                        Level = swingHigh,
                        Time = sweepTime,
                        Reference = $"SwingHigh_{swingHigh:F5}"
                    };
                }

                // Sweep down (manipulation)
                if (low < swingLow && close > swingLow)
                {
                    _lastSweepTime = sweepTime;
                    _lastSweepLevel = swingLow;

                    return new SweepInfo
                    {
                        Direction = "Down",
                        Level = swingLow,
                        Time = sweepTime,
                        Reference = $"SwingLow_{swingLow:F5}"
                    };
                }
            }

            return null;
        }

        /// <summary>
        /// DETECT MSS WITH DISPLACEMENT - Opposite direction MSS after sweep
        /// </summary>
        private MSSInfo DetectMSSWithDisplacement(Bars bars, int currentIdx, string sweepDirection)
        {
            // After UP sweep, expect DOWN MSS (bearish)
            // After DOWN sweep, expect UP MSS (bullish)
            string expectedMSSDirection = sweepDirection == "Up" ? "Bearish" : "Bullish";

            // Look for MSS in last 5 candles after sweep
            for (int i = currentIdx; i > Math.Max(0, currentIdx - 5); i--)
            {
                double open = bars.OpenPrices[i];
                double close = bars.ClosePrices[i];
                double high = bars.HighPrices[i];
                double low = bars.LowPrices[i];

                // Get recent structure levels
                double recentHigh = bars.HighPrices.Skip(Math.Max(0, i - 10)).Take(9).Max();
                double recentLow = bars.LowPrices.Skip(Math.Max(0, i - 10)).Take(9).Min();

                // Bullish MSS: Break above recent high
                if (expectedMSSDirection == "Bullish" && close > recentHigh)
                {
                    double displacement = close - open;
                    if (displacement > 0) // Valid bullish candle
                    {
                        return new MSSInfo
                        {
                            Side = "Bullish",
                            BreakLevel = recentHigh,
                            EntryCandle = i,
                            Time = bars.OpenTimes[i]
                        };
                    }
                }

                // Bearish MSS: Break below recent low
                if (expectedMSSDirection == "Bearish" && close < recentLow)
                {
                    double displacement = open - close;
                    if (displacement > 0) // Valid bearish candle
                    {
                        return new MSSInfo
                        {
                            Side = "Bearish",
                            BreakLevel = recentLow,
                            EntryCandle = i,
                            Time = bars.OpenTimes[i]
                        };
                    }
                }
            }

            return null;
        }

        /// <summary>
        /// VALIDATE STRUCTURE BREAK - Confirms structure break meets minimum threshold
        /// </summary>
        private MSSOrchestrator.StructBreak ValidateStructureBreak(Bars bars, int idx, string side)
        {
            double breakDistance = 0;
            double prevLevel = 0;
            double newLevel = 0;

            if (side == "Bullish")
            {
                // Find previous swing high
                prevLevel = bars.HighPrices.Skip(Math.Max(0, idx - 20)).Take(19).Max();
                newLevel = bars.HighPrices[idx];
                breakDistance = newLevel - prevLevel;
            }
            else
            {
                // Find previous swing low
                prevLevel = bars.LowPrices.Skip(Math.Max(0, idx - 20)).Take(19).Min();
                newLevel = bars.LowPrices[idx];
                breakDistance = prevLevel - newLevel;
            }

            double breakPips = breakDistance / _symbol.PipSize;

            if (breakPips < _minStructBreakPips)
                return null;

            return new MSSOrchestrator.StructBreak
            {
                Level = newLevel,
                Distance = breakDistance,
                DistancePips = breakPips
            };
        }

        /// <summary>
        /// IDENTIFY HTF POI - Finds Order Block or FVG zone
        /// </summary>
        private MSSOrchestrator.HTFPOI IdentifyHTF_POI(Bars bars, int idx, string side)
        {
            // Look for last opposite candle before MSS (Order Block logic)
            for (int i = idx - 1; i >= Math.Max(0, idx - 5); i--)
            {
                double open = bars.OpenPrices[i];
                double close = bars.ClosePrices[i];
                double high = bars.HighPrices[i];
                double low = bars.LowPrices[i];

                if (side == "Bullish")
                {
                    // Find last bearish candle (demand OB)
                    if (close < open)
                    {
                        return new MSSOrchestrator.HTFPOI
                        {
                            PriceTop = high,
                            PriceBottom = low,
                            Type = "OrderBlock",
                            Quality = 1.0,
                            CreatedAt = bars.OpenTimes[i]
                        };
                    }
                }
                else
                {
                    // Find last bullish candle (supply OB)
                    if (close > open)
                    {
                        return new MSSOrchestrator.HTFPOI
                        {
                            PriceTop = high,
                            PriceBottom = low,
                            Type = "OrderBlock",
                            Quality = 1.0,
                            CreatedAt = bars.OpenTimes[i]
                        };
                    }
                }
            }

            // Fallback: Use MSS candle itself as POI
            return new MSSOrchestrator.HTFPOI
            {
                PriceTop = bars.HighPrices[idx],
                PriceBottom = bars.LowPrices[idx],
                Type = "MSSCandle",
                Quality = 0.8,
                CreatedAt = bars.OpenTimes[idx]
            };
        }

        /// <summary>
        /// CALCULATE DISPLACEMENT - Measures displacement strength
        /// </summary>
        private MSSOrchestrator.DisplacementData CalculateDisplacement(Bars bars, int idx, MSSInfo mssInfo)
        {
            double open = bars.OpenPrices[idx];
            double close = bars.ClosePrices[idx];
            double high = bars.HighPrices[idx];
            double low = bars.LowPrices[idx];

            double displacement = mssInfo.Side == "Bullish" ? (close - open) : (open - close);
            double atrValue = CalculateATR(bars, idx, 14);
            double atrMultiple = atrValue > 0 ? displacement / atrValue : 0;

            // Check for FVG
            bool hasFVG = false;
            double fvgSize = 0;

            if (idx >= 2)
            {
                if (mssInfo.Side == "Bullish")
                {
                    double prevHigh = bars.HighPrices[idx - 2];
                    fvgSize = low - prevHigh;
                    hasFVG = fvgSize > 0;
                }
                else
                {
                    double prevLow = bars.LowPrices[idx - 2];
                    fvgSize = prevLow - high;
                    hasFVG = fvgSize > 0;
                }
            }

            return new MSSOrchestrator.DisplacementData
            {
                Size = displacement,
                ATRMultiple = atrMultiple,
                HasFVG = hasFVG,
                FVGSize = fvgSize
            };
        }

        /// <summary>
        /// CALCULATE ATR - Simple ATR calculation
        /// </summary>
        private double CalculateATR(Bars bars, int idx, int period)
        {
            if (idx < period) return 0;

            double sum = 0;
            for (int i = idx - period + 1; i <= idx; i++)
            {
                double tr = Math.Max(bars.HighPrices[i] - bars.LowPrices[i],
                            Math.Max(Math.Abs(bars.HighPrices[i] - bars.ClosePrices[i - 1]),
                                    Math.Abs(bars.LowPrices[i] - bars.ClosePrices[i - 1])));
                sum += tr;
            }

            return sum / period;
        }

        // Helper classes
        private class SweepInfo
        {
            public string Direction { get; set; }
            public double Level { get; set; }
            public DateTime Time { get; set; }
            public string Reference { get; set; }
        }

        private class MSSInfo
        {
            public string Side { get; set; }
            public double BreakLevel { get; set; }
            public int EntryCandle { get; set; }
            public DateTime Time { get; set; }
        }
    }

    /// <summary>
    /// HTF_MSS EVENT - Data structure for 15M MSS events
    /// </summary>
    public class HTF_MSSEvent
    {
        public string Side { get; set; } // "Bullish" or "Bearish"
        public MSSOrchestrator.HTFPOI HTFPOI { get; set; }
        public string SweepRef { get; set; }
        public MSSOrchestrator.DisplacementData Displacement { get; set; }
        public MSSOrchestrator.StructBreak StructBreak { get; set; }
        public DateTime ValidUntil { get; set; }
        public DateTime DetectedAt { get; set; }
        public TimeFrame HTFTimeframe { get; set; }
    }
}
