using System;
using cAlgo.API;

namespace CCTTB
{
    /// <summary>
    /// OTE (Optimal Trade Entry) touch detection system with tiered levels.
    /// Detects when price enters/touches OTE zones (50%, 61.8%, 70.5%, 79%) for Phase 3 entries.
    /// Week 1 Enhancement - Provides precise OTE monitoring for ping-pong strategy.
    /// </summary>
    public enum OTETouchLevel
    {
        None = 0,           // Not touched
        Shallow = 1,        // 50-61.8% touched (equilibrium)
        Optimal = 2,        // 61.8-79% touched (standard OTE)
        DeepOptimal = 3,    // 70.5-79% touched (sweet spot)
        Exceeded = 4        // >79% touched (too deep, potential invalidation)
    }

    public enum OTETouchMethod
    {
        WickTouch,      // Wick enters zone (most sensitive)
        BodyClose,      // Body closes in zone (medium)
        FullRetrace     // Price reaches specific level exactly (least sensitive)
    }

    public class OTEZoneData
    {
        public double High { get; set; }        // Top of OTE zone (e.g., 79%)
        public double Low { get; set; }         // Bottom of OTE zone (e.g., 61.8%)
        public double SweetSpot { get; set; }   // 70.5% sweet spot
        public double Equilibrium { get; set; } // 50% equilibrium
        public double SwingHigh { get; set; }   // Original swing high
        public double SwingLow { get; set; }    // Original swing low
        public TradeType Direction { get; set; } // Buy = bullish OTE, Sell = bearish OTE
        public DateTime CreatedAt { get; set; }
        public TimeFrame SourceTimeframe { get; set; }
        public bool IsValid { get; set; }
    }

    public class OTETouchDetector
    {
        private readonly Robot _bot;
        private readonly PhasedPolicySimple _policy;
        private readonly TradeJournal _journal;

        // OTE configuration (from policy or defaults)
        private readonly double _oteFibMin;     // 61.8%
        private readonly double _oteFibMax;     // 79%
        private readonly double _sweetSpot;     // 70.5%
        private readonly double _equilibrium;   // 50%
        private readonly int _proximityPips;    // Within X pips = "near"

        // Current OTE zone being monitored
        private OTEZoneData _currentOTE;
        private OTETouchLevel _lastTouchLevel = OTETouchLevel.None;
        private DateTime _lastTouchTime = DateTime.MinValue;

        public OTETouchDetector(
            Robot bot,
            PhasedPolicySimple policy,
            TradeJournal journal)
        {
            _bot = bot;
            _policy = policy;
            _journal = journal;

            // Load config from policy
            _oteFibMin = policy?.OTEFibMin() ?? 0.618;
            _oteFibMax = policy?.OTEFibMax() ?? 0.79;
            _sweetSpot = policy?.OTESweetSpot() ?? 0.705;
            _equilibrium = policy?.OTEEquilibrium() ?? 0.50;
            _proximityPips = policy?.OTEProximityPips() ?? 5;

            _bot.Print($"[OTETouch] Initialized: OTE={_oteFibMin:P1}-{_oteFibMax:P1}, Sweet={_sweetSpot:P1}, Proximity={_proximityPips}p");
        }

        /// <summary>
        /// Set/update the current OTE zone to monitor.
        /// </summary>
        /// <param name="swingHigh">Swing high price</param>
        /// <param name="swingLow">Swing low price</param>
        /// <param name="direction">Buy = looking for bullish OTE (price drops into zone), Sell = bearish OTE</param>
        /// <param name="sourceTimeframe">Timeframe of the swing (e.g., Daily, 4H)</param>
        public void SetOTEZone(double swingHigh, double swingLow, TradeType direction, TimeFrame sourceTimeframe)
        {
            double range = swingHigh - swingLow;

            if (range <= 0)
            {
                _journal?.Debug($"[OTETouch] Invalid swing range: H={swingHigh:F5}, L={swingLow:F5}");
                return;
            }

            _currentOTE = new OTEZoneData
            {
                SwingHigh = swingHigh,
                SwingLow = swingLow,
                Direction = direction,
                SourceTimeframe = sourceTimeframe,
                CreatedAt = DateTime.Now,
                IsValid = true
            };

            // Calculate OTE levels
            if (direction == TradeType.Buy)
            {
                // Bullish OTE: Price should retrace DOWN into zone (below swing high)
                _currentOTE.High = swingLow + (range * _oteFibMax);        // 79%
                _currentOTE.Low = swingLow + (range * _oteFibMin);         // 61.8%
                _currentOTE.SweetSpot = swingLow + (range * _sweetSpot);   // 70.5%
                _currentOTE.Equilibrium = swingLow + (range * _equilibrium); // 50%
            }
            else
            {
                // Bearish OTE: Price should retrace UP into zone (above swing low)
                _currentOTE.High = swingHigh - (range * _oteFibMin);       // 61.8% from top
                _currentOTE.Low = swingHigh - (range * _oteFibMax);        // 79% from top
                _currentOTE.SweetSpot = swingHigh - (range * _sweetSpot);  // 70.5%
                _currentOTE.Equilibrium = swingHigh - (range * _equilibrium); // 50%
            }

            if (_policy?.EnableDebugLogging() ?? false)
            {
                _journal?.Debug($"[OTETouch] OTE Zone Set: {direction} on {sourceTimeframe}");
                _journal?.Debug($"  Swing: {swingLow:F5} - {swingHigh:F5} (Range: {range:F5})");
                _journal?.Debug($"  OTE: {_currentOTE.Low:F5} - {_currentOTE.High:F5}");
                _journal?.Debug($"  Sweet Spot: {_currentOTE.SweetSpot:F5}");
                _journal?.Debug($"  Equilibrium: {_currentOTE.Equilibrium:F5}");
            }

            // Reset touch state
            _lastTouchLevel = OTETouchLevel.None;
            _lastTouchTime = DateTime.MinValue;
        }

        /// <summary>
        /// Get current OTE zone (read-only).
        /// </summary>
        public OTEZoneData GetCurrentOTE()
        {
            return _currentOTE;
        }

        /// <summary>
        /// Check if OTE zone is currently set and valid.
        /// </summary>
        public bool HasValidOTE()
        {
            return _currentOTE != null && _currentOTE.IsValid;
        }

        /// <summary>
        /// Get current touch level of OTE zone.
        /// </summary>
        /// <param name="method">Touch detection method</param>
        /// <returns>Touch level (None/Shallow/Optimal/DeepOptimal/Exceeded)</returns>
        public OTETouchLevel GetTouchLevel(OTETouchMethod method = OTETouchMethod.BodyClose)
        {
            if (!HasValidOTE())
                return OTETouchLevel.None;

            double currentPrice = GetRelevantPrice(method);
            return CalculateTouchLevel(currentPrice);
        }

        /// <summary>
        /// Check if price is near OTE zone (within proximity threshold).
        /// </summary>
        /// <param name="pips">Proximity threshold in pips (default from policy)</param>
        /// <returns>True if within proximity</returns>
        public bool IsNearOTE(int? pips = null)
        {
            if (!HasValidOTE())
                return false;

            int proximityPips = pips ?? _proximityPips;
            double proximityPrice = proximityPips * _bot.Symbol.PipSize;

            double currentPrice = _bot.Bars.ClosePrices.LastValue;

            // Check if within proximity of OTE boundaries
            bool nearLow = Math.Abs(currentPrice - _currentOTE.Low) <= proximityPrice;
            bool nearHigh = Math.Abs(currentPrice - _currentOTE.High) <= proximityPrice;
            bool withinZone = currentPrice >= _currentOTE.Low && currentPrice <= _currentOTE.High;

            return nearLow || nearHigh || withinZone;
        }

        /// <summary>
        /// Update and track OTE touch level (call on each bar/tick).
        /// </summary>
        /// <param name="method">Touch detection method</param>
        /// <returns>Current touch level</returns>
        public OTETouchLevel UpdateTouchLevel(OTETouchMethod method = OTETouchMethod.BodyClose)
        {
            OTETouchLevel currentLevel = GetTouchLevel(method);

            // Log level changes
            if (currentLevel != _lastTouchLevel)
            {
                if (_policy?.EnableDebugLogging() ?? false)
                {
                    _journal?.Debug($"[OTETouch] Level changed: {_lastTouchLevel} → {currentLevel} (Method: {method})");
                }

                _lastTouchLevel = currentLevel;
                _lastTouchTime = DateTime.Now;

                // Alert on Optimal/DeepOptimal touch
                if (currentLevel == OTETouchLevel.Optimal || currentLevel == OTETouchLevel.DeepOptimal)
                {
                    _journal?.Debug($"[OTETouch] 🎯 {currentLevel} OTE touched! Price: {_bot.Bars.ClosePrices.LastValue:F5}");
                }

                // Alert on Exceeded (invalidation warning)
                if (currentLevel == OTETouchLevel.Exceeded)
                {
                    _journal?.Debug($"[OTETouch] ⚠️ OTE EXCEEDED ({_oteFibMax:P0}) - Structure weakening! Price: {_bot.Bars.ClosePrices.LastValue:F5}");
                }
            }

            return currentLevel;
        }

        /// <summary>
        /// Check if OTE was touched within last N minutes.
        /// </summary>
        /// <param name="minutes">Time window in minutes</param>
        /// <returns>True if touched recently</returns>
        public bool WasTouchedRecently(int minutes = 60)
        {
            if (_lastTouchLevel < OTETouchLevel.Optimal)
                return false;

            return (DateTime.Now - _lastTouchTime).TotalMinutes <= minutes;
        }

        /// <summary>
        /// Invalidate current OTE zone (e.g., after trade exit or structure break).
        /// </summary>
        public void InvalidateOTE(string reason = "Manual invalidation")
        {
            if (_currentOTE != null)
            {
                _currentOTE.IsValid = false;
                if (_policy?.EnableDebugLogging() ?? false)
                {
                    _journal?.Debug($"[OTETouch] OTE invalidated: {reason}");
                }
            }

            _lastTouchLevel = OTETouchLevel.None;
        }

        /// <summary>
        /// Calculate touch level based on price position.
        /// </summary>
        private OTETouchLevel CalculateTouchLevel(double price)
        {
            if (_currentOTE == null)
                return OTETouchLevel.None;

            double invalidationPercent = _policy?.OTEInvalidationPercent() ?? 0.88;
            double range = _currentOTE.SwingHigh - _currentOTE.SwingLow;
            double invalidationLevel;

            if (_currentOTE.Direction == TradeType.Buy)
            {
                invalidationLevel = _currentOTE.SwingLow + (range * invalidationPercent);

                // Check levels from deepest to shallowest
                if (price <= invalidationLevel && price > _currentOTE.High)
                    return OTETouchLevel.Exceeded;

                if (price <= _currentOTE.High && price >= _currentOTE.SweetSpot)
                    return OTETouchLevel.DeepOptimal;

                if (price < _currentOTE.SweetSpot && price >= _currentOTE.Low)
                    return OTETouchLevel.Optimal;

                if (price < _currentOTE.Low && price >= _currentOTE.Equilibrium)
                    return OTETouchLevel.Shallow;
            }
            else  // Bearish
            {
                invalidationLevel = _currentOTE.SwingHigh - (range * invalidationPercent);

                // Check levels from deepest to shallowest
                if (price >= invalidationLevel && price < _currentOTE.Low)
                    return OTETouchLevel.Exceeded;

                if (price >= _currentOTE.Low && price <= _currentOTE.SweetSpot)
                    return OTETouchLevel.DeepOptimal;

                if (price > _currentOTE.SweetSpot && price <= _currentOTE.High)
                    return OTETouchLevel.Optimal;

                if (price > _currentOTE.High && price <= _currentOTE.Equilibrium)
                    return OTETouchLevel.Shallow;
            }

            return OTETouchLevel.None;
        }

        /// <summary>
        /// Get relevant price based on touch method.
        /// </summary>
        private double GetRelevantPrice(OTETouchMethod method)
        {
            switch (method)
            {
                case OTETouchMethod.WickTouch:
                    // Use most extreme price (high for bullish, low for bearish)
                    if (_currentOTE.Direction == TradeType.Buy)
                        return _bot.Bars.LowPrices.LastValue;  // Bullish OTE = check low
                    else
                        return _bot.Bars.HighPrices.LastValue; // Bearish OTE = check high

                case OTETouchMethod.BodyClose:
                    return _bot.Bars.ClosePrices.LastValue;

                case OTETouchMethod.FullRetrace:
                    // Use close for full retrace (must reach exactly)
                    return _bot.Bars.ClosePrices.LastValue;

                default:
                    return _bot.Bars.ClosePrices.LastValue;
            }
        }

        /// <summary>
        /// Print current OTE zone and status for debugging.
        /// </summary>
        public void PrintOTEStatus()
        {
            if (!HasValidOTE())
            {
                _bot.Print("[OTETouch] No valid OTE zone set");
                return;
            }

            double currentPrice = _bot.Bars.ClosePrices.LastValue;
            OTETouchLevel level = GetTouchLevel();

            _bot.Print($"╔════════════════════════════════════════╗");
            _bot.Print($"║   OTE ZONE STATUS");
            _bot.Print($"╚════════════════════════════════════════╝");
            _bot.Print($"Direction: {_currentOTE.Direction}");
            _bot.Print($"Source TF: {_currentOTE.SourceTimeframe}");
            _bot.Print($"Created: {_currentOTE.CreatedAt:HH:mm:ss}");
            _bot.Print($"");
            _bot.Print($"Swing Range: {_currentOTE.SwingLow:F5} - {_currentOTE.SwingHigh:F5}");
            _bot.Print($"");
            _bot.Print($"─── OTE Levels ───");
            _bot.Print($"Equilibrium (50%): {_currentOTE.Equilibrium:F5}");
            _bot.Print($"OTE Low (61.8%):   {_currentOTE.Low:F5}");
            _bot.Print($"Sweet Spot (70.5%): {_currentOTE.SweetSpot:F5}");
            _bot.Print($"OTE High (79%):    {_currentOTE.High:F5}");
            _bot.Print($"");
            _bot.Print($"─── Current Status ───");
            _bot.Print($"Current Price: {currentPrice:F5}");
            _bot.Print($"Touch Level: {level}");
            _bot.Print($"Is Near OTE: {(IsNearOTE() ? "✅" : "❌")} (within {_proximityPips}p)");
            _bot.Print($"Last Touch: {(_lastTouchTime == DateTime.MinValue ? "Never" : $"{_lastTouchTime:HH:mm:ss} ({_lastTouchLevel})")}");
            _bot.Print($"Valid: {(_currentOTE.IsValid ? "✅" : "❌")}");
            _bot.Print($"╚════════════════════════════════════════╝");
        }

        /// <summary>
        /// Get string representation of touch level for logging.
        /// </summary>
        public static string TouchLevelToString(OTETouchLevel level)
        {
            switch (level)
            {
                case OTETouchLevel.None: return "None (Outside OTE)";
                case OTETouchLevel.Shallow: return "Shallow (50-61.8%)";
                case OTETouchLevel.Optimal: return "Optimal (61.8-79%)";
                case OTETouchLevel.DeepOptimal: return "DeepOptimal (70.5-79% - SWEET SPOT)";
                case OTETouchLevel.Exceeded: return "Exceeded (>79% - TOO DEEP)";
                default: return "Unknown";
            }
        }
    }
}
