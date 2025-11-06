using System;
using cAlgo.API;
using cAlgo.API.Indicators;

namespace CCTTB
{
    /// <summary>
    /// ATR-based hybrid sweep buffer calculator for adaptive liquidity sweep detection.
    /// Uses 17-period ATR with configurable multipliers and min/max bounds per timeframe.
    /// Week 1 Enhancement - Replaces fixed 5-pip buffer with volatility-adaptive approach.
    /// </summary>
    public class SweepBufferCalculator
    {
        private readonly Robot _bot;
        private readonly AverageTrueRange _atr;
        private readonly PhasedPolicySimple _policy;
        private readonly TradeJournal _journal;

        // ATR configuration
        private readonly int _atrPeriod;

        // Cache for performance
        private DateTime _lastCalculation = DateTime.MinValue;
        private double _cachedBufferPrice = 0;
        private int _cacheValiditySeconds = 60;  // Cache for 1 minute

        public SweepBufferCalculator(
            Robot bot,
            PhasedPolicySimple policy,
            TradeJournal journal)
        {
            _bot = bot;
            _policy = policy;
            _journal = journal;

            // Get ATR period from policy or use default
            _atrPeriod = policy?.GetATRPeriod() ?? 17;

            // Initialize ATR indicator (access Bars/Indicators through Robot)
            _atr = _bot.Indicators.AverageTrueRange(_bot.Bars, _atrPeriod, MovingAverageType.Simple);

            _bot.Print($"[SweepBuffer] Initialized with ATR period: {_atrPeriod}");
        }

        /// <summary>
        /// Calculate adaptive sweep buffer in price units.
        /// Uses ATR-based calculation with min/max bounds from policy.
        /// </summary>
        /// <param name="timeframe">Timeframe for buffer calculation (e.g., "15m", "1h", "D1")</param>
        /// <param name="forceRecalculate">Force recalculation even if cached</param>
        /// <returns>Buffer distance in price units</returns>
        public double CalculateBuffer(string timeframe = null, bool forceRecalculate = false)
        {
            // Use cache if valid
            if (!forceRecalculate && (DateTime.Now - _lastCalculation).TotalSeconds < _cacheValiditySeconds)
            {
                return _cachedBufferPrice;
            }

            // Default to current chart timeframe if not specified
            if (string.IsNullOrEmpty(timeframe))
            {
                timeframe = GetTimeframeString(_bot.Bars.TimeFrame);
            }

            // Get ATR value (in price units)
            double atrValue = _atr.Result.LastValue;

            if (atrValue <= 0)
            {
                _journal?.Debug($"[SweepBuffer] ATR value is zero or negative, using default buffer");
                return GetDefaultBuffer(timeframe);
            }

            // Get multiplier and bounds from policy
            double atrMultiplier = _policy?.GetATRMultiplier(timeframe) ?? 0.25;
            int minBufferPips = _policy?.GetMinBufferPips(timeframe) ?? 3;
            int maxBufferPips = _policy?.GetMaxBufferPips(timeframe) ?? 20;

            // Calculate ATR-based buffer
            double atrBuffer = atrValue * atrMultiplier;

            // Convert to pips for clamping
            double atrBufferPips = atrBuffer / _bot.Symbol.PipSize;

            // Clamp to min/max bounds
            double clampedPips = Math.Max(minBufferPips, Math.Min(maxBufferPips, atrBufferPips));

            // Convert back to price
            double finalBufferPrice = clampedPips * _bot.Symbol.PipSize;

            // Cache result
            _cachedBufferPrice = finalBufferPrice;
            _lastCalculation = DateTime.Now;

            // Log calculation
            if (_policy?.EnableDebugLogging() ?? false)
            {
                _journal?.Debug($"[SweepBuffer] TF={timeframe}, ATR={atrValue:F5}, " +
                               $"ATR×{atrMultiplier}={atrBuffer:F5} ({atrBufferPips:F1}p), " +
                               $"Clamped={clampedPips:F1}p (min={minBufferPips}, max={maxBufferPips}), " +
                               $"Final={finalBufferPrice:F5}");
            }

            return finalBufferPrice;
        }

        /// <summary>
        /// Calculate buffer in pips (for display/logging).
        /// </summary>
        public double CalculateBufferPips(string timeframe = null, bool forceRecalculate = false)
        {
            double bufferPrice = CalculateBuffer(timeframe, forceRecalculate);
            return bufferPrice / _bot.Symbol.PipSize;
        }

        /// <summary>
        /// Validate if a price level qualifies as a sweep with current buffer.
        /// </summary>
        /// <param name="sweepLevel">The liquidity level being swept</param>
        /// <param name="sweepDirection">Buy = sweep above, Sell = sweep below</param>
        /// <param name="timeframe">Timeframe for buffer calculation</param>
        /// <param name="lookbackBars">Number of bars to check</param>
        /// <returns>True if valid sweep detected</returns>
        public bool ValidateSweep(
            double sweepLevel,
            TradeType sweepDirection,
            string timeframe = null,
            int lookbackBars = 3)
        {
            double buffer = CalculateBuffer(timeframe);
            bool requireBodyClose = _policy?.RequireBodyClose() ?? true;
            bool requireDisplacement = _policy?.RequireDisplacement() ?? true;

            // Check last N bars for sweep
            for (int i = 0; i < Math.Min(lookbackBars, _bot.Bars.Count); i++)
            {
                int index = _bot.Bars.Count - 1 - i;
                if (index < 0) continue;

                double high = _bot.Bars.HighPrices[index];
                double low = _bot.Bars.LowPrices[index];
                double close = _bot.Bars.ClosePrices[index];

                if (sweepDirection == TradeType.Buy)
                {
                    // Buyside sweep: High must exceed level + buffer
                    if (high < sweepLevel + buffer)
                        continue;

                    // Optional: Require body close beyond level (not just wick)
                    if (requireBodyClose && close < sweepLevel)
                    {
                        if (_policy?.EnableDebugLogging() ?? false)
                        {
                            _journal?.Debug($"[SweepBuffer] Buyside wick touched {sweepLevel:F5} but body didn't close beyond → Invalid");
                        }
                        continue;
                    }

                    // Optional: Require displacement (FVG candle)
                    if (requireDisplacement && !HasDisplacement(index))
                    {
                        if (_policy?.EnableDebugLogging() ?? false)
                        {
                            _journal?.Debug($"[SweepBuffer] Buyside sweep at {sweepLevel:F5} but no displacement → Invalid");
                        }
                        continue;
                    }

                    // Valid sweep!
                    if (_policy?.EnableDebugLogging() ?? false)
                    {
                        _journal?.Debug($"[SweepBuffer] ✅ Buyside sweep confirmed: High={high:F5}, " +
                                       $"Level={sweepLevel:F5}, Buffer={buffer / _bot.Symbol.PipSize:F1}p, " +
                                       $"BodyClose={(requireBodyClose ? close >= sweepLevel : true)}, " +
                                       $"Displacement={!requireDisplacement || HasDisplacement(index)}");
                    }
                    return true;
                }
                else  // Sell = Sellside sweep
                {
                    // Sellside sweep: Low must exceed level - buffer
                    if (low > sweepLevel - buffer)
                        continue;

                    // Optional: Require body close beyond level
                    if (requireBodyClose && close > sweepLevel)
                    {
                        if (_policy?.EnableDebugLogging() ?? false)
                        {
                            _journal?.Debug($"[SweepBuffer] Sellside wick touched {sweepLevel:F5} but body didn't close beyond → Invalid");
                        }
                        continue;
                    }

                    // Optional: Require displacement
                    if (requireDisplacement && !HasDisplacement(index))
                    {
                        if (_policy?.EnableDebugLogging() ?? false)
                        {
                            _journal?.Debug($"[SweepBuffer] Sellside sweep at {sweepLevel:F5} but no displacement → Invalid");
                        }
                        continue;
                    }

                    // Valid sweep!
                    if (_policy?.EnableDebugLogging() ?? false)
                    {
                        _journal?.Debug($"[SweepBuffer] ✅ Sellside sweep confirmed: Low={low:F5}, " +
                                       $"Level={sweepLevel:F5}, Buffer={buffer / _bot.Symbol.PipSize:F1}p, " +
                                       $"BodyClose={(requireBodyClose ? close <= sweepLevel : true)}, " +
                                       $"Displacement={!requireDisplacement || HasDisplacement(index)}");
                    }
                    return true;
                }
            }

            return false;  // No valid sweep found in lookback
        }

        /// <summary>
        /// Check if bar has displacement (momentum candle, typically with FVG).
        /// Displacement = body is at least 1.5× larger than wicks.
        /// </summary>
        private bool HasDisplacement(int index)
        {
            if (index < 0 || index >= _bot.Bars.Count)
                return false;

            double open = _bot.Bars.OpenPrices[index];
            double close = _bot.Bars.ClosePrices[index];
            double high = _bot.Bars.HighPrices[index];
            double low = _bot.Bars.LowPrices[index];

            double body = Math.Abs(close - open);
            double upperWick = high - Math.Max(open, close);
            double lowerWick = Math.Min(open, close) - low;
            double totalWicks = upperWick + lowerWick;

            if (totalWicks == 0)
                return true;  // No wicks = pure displacement

            double minFactor = _policy?.MinDisplacementFactor() ?? 1.5;
            bool hasDisplacement = body >= (totalWicks * minFactor);

            return hasDisplacement;
        }

        /// <summary>
        /// Get default buffer when ATR fails or policy not loaded.
        /// </summary>
        private double GetDefaultBuffer(string timeframe)
        {
            // Default: 5 pips for intraday, 10 pips for daily
            int defaultPips = (timeframe == "D1" || timeframe == "Daily") ? 10 : 5;
            return defaultPips * _bot.Symbol.PipSize;
        }

        /// <summary>
        /// Convert cAlgo TimeFrame to string (e.g., "15m", "1h", "D1").
        /// </summary>
        private string GetTimeframeString(TimeFrame tf)
        {
            if (tf == TimeFrame.Minute) return "1m";
            if (tf == TimeFrame.Minute5) return "5m";
            if (tf == TimeFrame.Minute15) return "15m";
            if (tf == TimeFrame.Hour) return "1h";
            if (tf == TimeFrame.Hour4) return "4h";
            if (tf == TimeFrame.Daily) return "D1";
            if (tf == TimeFrame.Weekly) return "W1";
            return "15m";  // Default
        }

        /// <summary>
        /// Get current ATR value for external use.
        /// </summary>
        public double GetCurrentATR()
        {
            return _atr.Result.LastValue;
        }

        /// <summary>
        /// Get current ATR in pips for external use.
        /// </summary>
        public double GetCurrentATRPips()
        {
            return _atr.Result.LastValue / _bot.Symbol.PipSize;
        }

        /// <summary>
        /// Print buffer calculation details for debugging.
        /// </summary>
        public void PrintBufferInfo(string timeframe = null)
        {
            if (string.IsNullOrEmpty(timeframe))
                timeframe = GetTimeframeString(_bot.Bars.TimeFrame);

            double buffer = CalculateBuffer(timeframe, forceRecalculate: true);
            double bufferPips = buffer / _bot.Symbol.PipSize;
            double atr = GetCurrentATR();
            double atrPips = GetCurrentATRPips();
            double multiplier = _policy?.GetATRMultiplier(timeframe) ?? 0.25;
            int minPips = _policy?.GetMinBufferPips(timeframe) ?? 3;
            int maxPips = _policy?.GetMaxBufferPips(timeframe) ?? 20;

            _bot.Print($"╔════════════════════════════════════════╗");
            _bot.Print($"║   SWEEP BUFFER INFO ({timeframe})");
            _bot.Print($"╚════════════════════════════════════════╝");
            _bot.Print($"ATR ({_atrPeriod}): {atr:F5} ({atrPips:F1} pips)");
            _bot.Print($"Multiplier: {multiplier:F2}");
            _bot.Print($"ATR Buffer: {atr * multiplier:F5} ({atrPips * multiplier:F1} pips)");
            _bot.Print($"Bounds: {minPips} - {maxPips} pips");
            _bot.Print($"Final Buffer: {buffer:F5} ({bufferPips:F1} pips)");
            _bot.Print($"Body Close Required: {(_policy?.RequireBodyClose() ?? true ? "✅" : "❌")}");
            _bot.Print($"Displacement Required: {(_policy?.RequireDisplacement() ?? true ? "✅" : "❌")}");
            _bot.Print($"╚════════════════════════════════════════╝");
        }
    }
}
