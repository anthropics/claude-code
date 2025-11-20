using cAlgo.API;
using cAlgo.API.Internals;
using System;
using System.Collections.Generic;
using System.Linq;

namespace CCTTB
{
    /// <summary>
    /// LTF MSS DETECTOR (5M) - Detects lower timeframe confirmations for HTF MSS
    /// Emits LTF_CONFIRM events: side, entry, stopLoss, takeProfit, ltfPOI, displacement
    /// Part of MSS Orchestrator dual-timeframe system (15M bias → 5M entry)
    /// </summary>
    public class LTF_MSS_Detector
    {
        private readonly Robot _bot;
        private readonly Symbol _symbol;
        private readonly OptimalTradeEntryDetector _oteDetector;
        private readonly MarketDataProvider _marketData;

        // Configuration
        private readonly TimeFrame _ltfTimeframe = TimeFrame.Minute5;
        private readonly double _oteMin = 0.618;
        private readonly double _oteMax = 0.79;

        // Active HTF context (set by orchestrator)
        private HTF_MSSEvent _activeHTFContext = null;

        public LTF_MSS_Detector(Robot bot, Symbol symbol, OptimalTradeEntryDetector oteDetector,
            MarketDataProvider marketData)
        {
            _bot = bot;
            _symbol = symbol;
            _oteDetector = oteDetector;
            _marketData = marketData;
        }

        /// <summary>
        /// SET HTF CONTEXT - Called by orchestrator when HTF MSS is detected
        /// </summary>
        public void SetHTFContext(HTF_MSSEvent htfEvent)
        {
            _activeHTFContext = htfEvent;
            _bot.Print($"[LTF_MSS] HTF context set: {htfEvent.Side} MSS | POI: {htfEvent.HTFPOI.PriceTop:F5}-{htfEvent.HTFPOI.PriceBottom:F5} | Valid until: {htfEvent.ValidUntil:HH:mm}");
        }

        /// <summary>
        /// CLEAR HTF CONTEXT - Called when HTF window expires or entry taken
        /// </summary>
        public void ClearHTFContext()
        {
            if (_activeHTFContext != null)
            {
                _bot.Print($"[LTF_MSS] HTF context cleared: {_activeHTFContext.Side}");
                _activeHTFContext = null;
            }
        }

        /// <summary>
        /// DETECT LTF CONFIRMATION - Main detection logic called on 5M bar close
        /// </summary>
        public LTF_ConfirmEvent DetectLTF_Confirmation()
        {
            // Must have active HTF context
            if (_activeHTFContext == null)
                return null;

            // Check if HTF context expired
            if (DateTime.Now > _activeHTFContext.ValidUntil)
            {
                _bot.Print($"[LTF_MSS] HTF context expired at {_activeHTFContext.ValidUntil:HH:mm}");
                ClearHTFContext();
                return null;
            }

            try
            {
                var ltfBars = _bot.MarketData.GetBars(_ltfTimeframe, _symbol.Name);
                if (ltfBars.Count < 50) return null;

                int idx = ltfBars.Count - 2; // Last completed candle
                if (idx < 2) return null;

                // Step 1: Detect LTF MSS aligned with HTF direction
                var ltfMSS = DetectAlignedLTF_MSS(ltfBars, idx);
                if (ltfMSS == null)
                {
                    // No LTF MSS yet - still valid, just waiting
                    return null;
                }

                // Step 2: Check for OTE pullback
                var otePullback = DetectOTE_Pullback(ltfBars, idx, ltfMSS);
                if (otePullback == null)
                {
                    _bot.Print($"[LTF_MSS] LTF MSS detected but no OTE pullback yet");
                    return null;
                }

                // Step 3: Identify LTF POI (refined entry zone)
                var ltfPOI = IdentifyLTF_POI(ltfBars, idx, ltfMSS.Side, otePullback);
                if (ltfPOI == null)
                {
                    _bot.Print("[LTF_MSS] No LTF POI identified");
                    return null;
                }

                // Step 4: Validate entry is inside HTF POI
                double currentPrice = ltfBars.ClosePrices[idx];
                if (!IsInsideHTF_POI(currentPrice))
                {
                    _bot.Print($"[LTF_MSS] Entry {currentPrice:F5} outside HTF POI {_activeHTFContext.HTFPOI.PriceTop:F5}-{_activeHTFContext.HTFPOI.PriceBottom:F5}");
                    return null;
                }

                // Step 5: Calculate entry parameters
                var entryParams = CalculateEntryParameters(ltfBars, idx, ltfMSS, ltfPOI, otePullback);
                if (entryParams == null)
                {
                    _bot.Print("[LTF_MSS] Entry parameters calculation failed");
                    return null;
                }

                // Step 6: Calculate displacement
                var displacement = CalculateLTF_Displacement(ltfBars, idx, ltfMSS);

                // Step 7: Create LTF_CONFIRM event
                var ltfEvent = new LTF_ConfirmEvent
                {
                    Side = ltfMSS.Side,
                    EntryPrice = entryParams.EntryPrice,
                    StopLoss = entryParams.StopLoss,
                    TakeProfit = entryParams.TakeProfit,
                    LTFPOI = ltfPOI,
                    Displacement = displacement,
                    DetectedAt = ltfBars.OpenTimes[idx],
                    HTFReference = _activeHTFContext.SweepRef
                };

                _bot.Print($"[LTF_MSS] ✅ {ltfMSS.Side} LTF confirmation | Entry: {entryParams.EntryPrice:F5} | SL: {entryParams.StopLoss:F5} | TP: {entryParams.TakeProfit:F5} | RR: {entryParams.RiskReward:F2}");

                return ltfEvent;
            }
            catch (Exception ex)
            {
                _bot.Print($"[LTF_MSS] ERROR: {ex.Message}");
                return null;
            }
        }

        /// <summary>
        /// DETECT ALIGNED LTF MSS - Finds 5M MSS matching HTF direction
        /// </summary>
        private LTF_MSSInfo DetectAlignedLTF_MSS(Bars bars, int currentIdx)
        {
            string expectedSide = _activeHTFContext.Side;

            // Look for LTF MSS in last 10 candles
            for (int i = currentIdx; i > Math.Max(0, currentIdx - 10); i--)
            {
                double open = bars.OpenPrices[i];
                double close = bars.ClosePrices[i];
                double high = bars.HighPrices[i];
                double low = bars.LowPrices[i];

                // Get recent structure
                double recentHigh = bars.HighPrices.Skip(Math.Max(0, i - 20)).Take(19).Max();
                double recentLow = bars.LowPrices.Skip(Math.Max(0, i - 20)).Take(19).Min();

                // Bullish LTF MSS
                if (expectedSide == "Bullish" && close > recentHigh && close > open)
                {
                    double displacement = close - open;
                    if (displacement > 0)
                    {
                        return new LTF_MSSInfo
                        {
                            Side = "Bullish",
                            BreakLevel = recentHigh,
                            CandleIndex = i,
                            Time = bars.OpenTimes[i],
                            Displacement = displacement
                        };
                    }
                }

                // Bearish LTF MSS
                if (expectedSide == "Bearish" && close < recentLow && close < open)
                {
                    double displacement = open - close;
                    if (displacement > 0)
                    {
                        return new LTF_MSSInfo
                        {
                            Side = "Bearish",
                            BreakLevel = recentLow,
                            CandleIndex = i,
                            Time = bars.OpenTimes[i],
                            Displacement = displacement
                        };
                    }
                }
            }

            return null;
        }

        /// <summary>
        /// DETECT OTE PULLBACK - Checks for 0.618-0.79 retracement
        /// </summary>
        private OTE_PullbackInfo DetectOTE_Pullback(Bars bars, int idx, LTF_MSSInfo ltfMSS)
        {
            int mssIdx = ltfMSS.CandleIndex;

            // Get MSS swing
            double swingHigh = 0;
            double swingLow = 0;

            if (ltfMSS.Side == "Bullish")
            {
                // Find swing low before MSS and swing high at MSS
                swingLow = bars.LowPrices.Skip(Math.Max(0, mssIdx - 10)).Take(10).Min();
                swingHigh = bars.HighPrices[mssIdx];
            }
            else
            {
                // Find swing high before MSS and swing low at MSS
                swingHigh = bars.HighPrices.Skip(Math.Max(0, mssIdx - 10)).Take(10).Max();
                swingLow = bars.LowPrices[mssIdx];
            }

            double swingRange = Math.Abs(swingHigh - swingLow);
            if (swingRange == 0) return null;

            // Calculate OTE levels
            double ote618 = ltfMSS.Side == "Bullish" ?
                swingHigh - (swingRange * _oteMin) :
                swingLow + (swingRange * _oteMin);

            double ote79 = ltfMSS.Side == "Bullish" ?
                swingHigh - (swingRange * _oteMax) :
                swingLow + (swingRange * _oteMax);

            // Check if current price is in OTE zone
            double currentPrice = bars.ClosePrices[idx];

            bool inOTEZone = false;
            if (ltfMSS.Side == "Bullish")
            {
                inOTEZone = currentPrice >= ote79 && currentPrice <= ote618;
            }
            else
            {
                inOTEZone = currentPrice <= ote79 && currentPrice >= ote618;
            }

            if (!inOTEZone)
                return null;

            return new OTE_PullbackInfo
            {
                OTE618Level = ote618,
                OTE79Level = ote79,
                SwingHigh = swingHigh,
                SwingLow = swingLow,
                InOTEZone = true
            };
        }

        /// <summary>
        /// IDENTIFY LTF POI - Finds refined entry zone (OB or FVG)
        /// </summary>
        private MSSOrchestrator.LTFPOI IdentifyLTF_POI(Bars bars, int idx, string side, OTE_PullbackInfo ote)
        {
            // Look for last opposite candle in OTE zone (Order Block)
            for (int i = idx; i >= Math.Max(0, idx - 5); i--)
            {
                double open = bars.OpenPrices[i];
                double close = bars.ClosePrices[i];
                double high = bars.HighPrices[i];
                double low = bars.LowPrices[i];

                // Check if candle is in OTE zone
                bool inOTE = false;
                if (side == "Bullish")
                {
                    inOTE = low >= ote.OTE79Level && high <= ote.OTE618Level;
                }
                else
                {
                    inOTE = high <= ote.OTE79Level && low >= ote.OTE618Level;
                }

                if (!inOTE) continue;

                if (side == "Bullish")
                {
                    // Find last bearish candle (demand OB)
                    if (close < open)
                    {
                        return new MSSOrchestrator.LTFPOI
                        {
                            Top = high,
                            Bottom = low,
                            Type = "OrderBlock"
                        };
                    }
                }
                else
                {
                    // Find last bullish candle (supply OB)
                    if (close > open)
                    {
                        return new MSSOrchestrator.LTFPOI
                        {
                            Top = high,
                            Bottom = low,
                            Type = "OrderBlock"
                        };
                    }
                }
            }

            // Fallback: Use OTE zone itself
            return new MSSOrchestrator.LTFPOI
            {
                Top = side == "Bullish" ? ote.OTE618Level : ote.OTE79Level,
                Bottom = side == "Bullish" ? ote.OTE79Level : ote.OTE618Level,
                Type = "OTEZone"
            };
        }

        /// <summary>
        /// IS INSIDE HTF POI - Validates entry is within HTF zone
        /// </summary>
        private bool IsInsideHTF_POI(double price)
        {
            if (_activeHTFContext == null || _activeHTFContext.HTFPOI == null)
                return false;

            return price >= _activeHTFContext.HTFPOI.PriceBottom &&
                   price <= _activeHTFContext.HTFPOI.PriceTop;
        }

        /// <summary>
        /// CALCULATE ENTRY PARAMETERS - Determines entry, SL, TP
        /// </summary>
        private EntryParameters CalculateEntryParameters(Bars bars, int idx, LTF_MSSInfo ltfMSS,
            MSSOrchestrator.LTFPOI ltfPOI, OTE_PullbackInfo ote)
        {
            double entryPrice = bars.ClosePrices[idx];

            // Stop Loss: Below LTF POI for bullish, above for bearish
            double stopLoss = 0;
            double buffer = 5 * _symbol.PipSize; // 5 pip buffer

            if (ltfMSS.Side == "Bullish")
            {
                stopLoss = ltfPOI.Bottom - buffer;
            }
            else
            {
                stopLoss = ltfPOI.Top + buffer;
            }

            double slDistance = Math.Abs(entryPrice - stopLoss);

            // Take Profit: Use HTF MSS opposite liquidity or 2:1 RR minimum
            double takeProfit = 0;

            if (_activeHTFContext.StructBreak != null)
            {
                // Target HTF structure break level
                if (ltfMSS.Side == "Bullish")
                {
                    takeProfit = _activeHTFContext.StructBreak.Level + (slDistance * 2);
                }
                else
                {
                    takeProfit = _activeHTFContext.StructBreak.Level - (slDistance * 2);
                }
            }
            else
            {
                // Fallback: 2:1 RR
                if (ltfMSS.Side == "Bullish")
                {
                    takeProfit = entryPrice + (slDistance * 2);
                }
                else
                {
                    takeProfit = entryPrice - (slDistance * 2);
                }
            }

            double tpDistance = Math.Abs(takeProfit - entryPrice);
            double riskReward = slDistance > 0 ? tpDistance / slDistance : 0;

            // Validate minimum RR
            if (riskReward < 1.5)
            {
                _bot.Print($"[LTF_MSS] RR too low: {riskReward:F2} (need 1.5+)");
                return null;
            }

            return new EntryParameters
            {
                EntryPrice = entryPrice,
                StopLoss = stopLoss,
                TakeProfit = takeProfit,
                RiskReward = riskReward
            };
        }

        /// <summary>
        /// CALCULATE LTF DISPLACEMENT - Measures LTF displacement strength
        /// </summary>
        private MSSOrchestrator.DisplacementData CalculateLTF_Displacement(Bars bars, int idx, LTF_MSSInfo ltfMSS)
        {
            int mssIdx = ltfMSS.CandleIndex;
            double displacement = ltfMSS.Displacement;
            double atrValue = CalculateATR(bars, mssIdx, 14);
            double atrMultiple = atrValue > 0 ? displacement / atrValue : 0;

            // Check for FVG
            bool hasFVG = false;
            double fvgSize = 0;

            if (mssIdx >= 2)
            {
                if (ltfMSS.Side == "Bullish")
                {
                    double prevHigh = bars.HighPrices[mssIdx - 2];
                    double currLow = bars.LowPrices[mssIdx];
                    fvgSize = currLow - prevHigh;
                    hasFVG = fvgSize > 0;
                }
                else
                {
                    double prevLow = bars.LowPrices[mssIdx - 2];
                    double currHigh = bars.HighPrices[mssIdx];
                    fvgSize = prevLow - currHigh;
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
        private class LTF_MSSInfo
        {
            public string Side { get; set; }
            public double BreakLevel { get; set; }
            public int CandleIndex { get; set; }
            public DateTime Time { get; set; }
            public double Displacement { get; set; }
        }

        private class OTE_PullbackInfo
        {
            public double OTE618Level { get; set; }
            public double OTE79Level { get; set; }
            public double SwingHigh { get; set; }
            public double SwingLow { get; set; }
            public bool InOTEZone { get; set; }
        }

        private class EntryParameters
        {
            public double EntryPrice { get; set; }
            public double StopLoss { get; set; }
            public double TakeProfit { get; set; }
            public double RiskReward { get; set; }
        }
    }

    /// <summary>
    /// LTF_CONFIRM EVENT - Data structure for 5M confirmation events
    /// </summary>
    public class LTF_ConfirmEvent
    {
        public string Side { get; set; }
        public double EntryPrice { get; set; }
        public double StopLoss { get; set; }
        public double TakeProfit { get; set; }
        public MSSOrchestrator.LTFPOI LTFPOI { get; set; }
        public MSSOrchestrator.DisplacementData Displacement { get; set; }
        public DateTime DetectedAt { get; set; }
        public string HTFReference { get; set; }
    }
}
