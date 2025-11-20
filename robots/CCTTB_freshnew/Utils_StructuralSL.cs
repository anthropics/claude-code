using System;
using cAlgo.API;
using cAlgo.API.Internals;
using CCTTB.MSS.Core.Detectors;

namespace CCTTB
{
    /// <summary>
    /// STRUCTURAL STOP LOSS CALCULATOR
    /// Places stop loss at the structural invalidation point (swing high/low) instead of fixed pips.
    ///
    /// Human-Like Logic:
    /// - For LONG trades: SL below the swing low that formed before entry
    /// - For SHORT trades: SL above the swing high that formed before entry
    /// - Adds adaptive buffer (ATR-based or fixed pips)
    /// - Validates against min/max SL constraints for risk management
    ///
    /// Example (LONG):
    ///   Swing Low = 1.08500, Buffer = 3 pips → SL = 1.08470
    ///   If this level breaks, the bullish structure is invalidated (trade is wrong)
    /// </summary>
    public class StructuralSLCalculator
    {
        private readonly Robot _robot;
        private readonly Symbol _symbol;
        private readonly bool _debug;

        public StructuralSLCalculator(Robot robot, Symbol symbol, bool debug)
        {
            _robot = robot;
            _symbol = symbol;
            _debug = debug;
        }

        /// <summary>
        /// Calculates structural stop loss based on swing invalidation.
        /// Returns SL price and distance in pips.
        /// </summary>
        public StructuralSLResult CalculateStructuralSL(
            Bars bars,
            double entryPrice,
            TradeType tradeType,
            double bufferPips = 3.0,
            double minSLPips = 15.0,
            double maxSLPips = 50.0,
            int swingPivot = 2)
        {
            try
            {
                int currentIndex = bars.Count - 1;
                double invalidationLevel = 0;
                int swingIndex = -1;

                // Convert DataSeries to List for SwingDetector compatibility
                int lookbackMax = Math.Min(100, bars.Count); // Look back max 100 bars for swing
                var highsList = new System.Collections.Generic.List<double>();
                var lowsList = new System.Collections.Generic.List<double>();

                int startIdx = bars.Count - lookbackMax;
                for (int i = startIdx; i < bars.Count; i++)
                {
                    highsList.Add(bars.HighPrices[i]);
                    lowsList.Add(bars.LowPrices[i]);
                }

                // Find structural invalidation point
                if (tradeType == TradeType.Buy)
                {
                    // LONG: Find last swing low before current bar
                    int relativeIndex = highsList.Count - 1; // Current bar in the sub-list
                    swingIndex = SwingDetector.LastSwingLowBefore(lowsList, relativeIndex, swingPivot, strict: false);

                    if (swingIndex >= 0)
                    {
                        invalidationLevel = lowsList[swingIndex];
                    }
                    else
                    {
                        // Fallback: Use recent lowest low (last 20 bars)
                        int fallbackLookback = Math.Min(20, lowsList.Count);
                        invalidationLevel = lowsList[lowsList.Count - fallbackLookback];
                        for (int i = lowsList.Count - fallbackLookback; i < lowsList.Count; i++)
                        {
                            if (lowsList[i] < invalidationLevel)
                                invalidationLevel = lowsList[i];
                        }
                    }
                }
                else // TradeType.Sell
                {
                    // SHORT: Find last swing high before current bar
                    int relativeIndex = highsList.Count - 1; // Current bar in the sub-list
                    swingIndex = SwingDetector.LastSwingHighBefore(highsList, relativeIndex, swingPivot, strict: false);

                    if (swingIndex >= 0)
                    {
                        invalidationLevel = highsList[swingIndex];
                    }
                    else
                    {
                        // Fallback: Use recent highest high (last 20 bars)
                        int fallbackLookback = Math.Min(20, highsList.Count);
                        invalidationLevel = highsList[highsList.Count - fallbackLookback];
                        for (int i = highsList.Count - fallbackLookback; i < highsList.Count; i++)
                        {
                            if (highsList[i] > invalidationLevel)
                                invalidationLevel = highsList[i];
                        }
                    }
                }

                // Apply buffer
                double bufferDistance = bufferPips * _symbol.PipSize;
                double slPrice = (tradeType == TradeType.Buy)
                    ? invalidationLevel - bufferDistance  // Below swing low
                    : invalidationLevel + bufferDistance; // Above swing high

                // Calculate SL distance
                double slDistancePips = Math.Abs(entryPrice - slPrice) / _symbol.PipSize;

                // Validate against constraints
                if (slDistancePips < minSLPips)
                {
                    // SL too tight - enforce minimum
                    slDistancePips = minSLPips;
                    slPrice = (tradeType == TradeType.Buy)
                        ? entryPrice - (slDistancePips * _symbol.PipSize)
                        : entryPrice + (slDistancePips * _symbol.PipSize);

                    if (_debug)
                        _robot.Print($"[STRUCTURAL SL] Too tight ({slDistancePips:F1} pips) → Clamped to min {minSLPips:F1} pips");
                }
                else if (slDistancePips > maxSLPips)
                {
                    // SL too wide - enforce maximum
                    slDistancePips = maxSLPips;
                    slPrice = (tradeType == TradeType.Buy)
                        ? entryPrice - (slDistancePips * _symbol.PipSize)
                        : entryPrice + (slDistancePips * _symbol.PipSize);

                    if (_debug)
                        _robot.Print($"[STRUCTURAL SL] Too wide ({slDistancePips:F1} pips) → Clamped to max {maxSLPips:F1} pips");
                }

                var result = new StructuralSLResult
                {
                    StopLossPrice = slPrice,
                    StopLossPips = slDistancePips,
                    InvalidationLevel = invalidationLevel,
                    SwingIndex = swingIndex,
                    BufferApplied = bufferPips,
                    WasClamped = (slDistancePips == minSLPips || slDistancePips == maxSLPips)
                };

                if (_debug)
                {
                    string swingType = (tradeType == TradeType.Buy) ? "Swing Low" : "Swing High";
                    _robot.Print($"[STRUCTURAL SL] {tradeType} Entry: {entryPrice:F5}");
                    _robot.Print($"[STRUCTURAL SL] {swingType}: {invalidationLevel:F5} (Bar {swingIndex})");
                    _robot.Print($"[STRUCTURAL SL] Buffer: {bufferPips:F1} pips → SL: {slPrice:F5} ({slDistancePips:F1} pips)");
                }

                return result;
            }
            catch (Exception ex)
            {
                _robot.Print($"[STRUCTURAL SL] ERROR: {ex.Message}");

                // Fallback: Use fixed SL if calculation fails
                double fallbackSL = (tradeType == TradeType.Buy)
                    ? entryPrice - (minSLPips * _symbol.PipSize)
                    : entryPrice + (minSLPips * _symbol.PipSize);

                return new StructuralSLResult
                {
                    StopLossPrice = fallbackSL,
                    StopLossPips = minSLPips,
                    InvalidationLevel = 0,
                    SwingIndex = -1,
                    BufferApplied = 0,
                    WasClamped = true
                };
            }
        }

        /// <summary>
        /// Result of structural SL calculation
        /// </summary>
        public class StructuralSLResult
        {
            public double StopLossPrice { get; set; }       // Actual SL price to use
            public double StopLossPips { get; set; }        // Distance in pips from entry
            public double InvalidationLevel { get; set; }   // Original swing high/low
            public int SwingIndex { get; set; }             // Bar index of the swing (-1 if fallback used)
            public double BufferApplied { get; set; }       // Buffer pips applied
            public bool WasClamped { get; set; }            // True if clamped to min/max
        }
    }
}
