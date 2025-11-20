using System;
using System.Collections.Generic;
using System.Linq;
using System.Text;
using cAlgo.API;

namespace CCTTB
{
    /// <summary>
    /// ADVANCED FEATURE: Multi-Timeframe Bias Integration System
    /// Implements sophisticated top-down analysis: Daily → M15 → Confluence Scoring
    /// Mimics human trader's narrative-driven decision making
    /// </summary>

    public enum KeyLevelInteractionType
    {
        None,
        RejectionAtSupport,      // Wick + reversal at support (bullish)
        RejectionAtResistance,   // Wick + reversal at resistance (bearish)
        BreakAboveResistance,    // Strong break above (bullish)
        BreakBelowSupport,       // Strong break below (bearish)
        TestingSupport,          // Consolidating near support
        TestingResistance        // Consolidating near resistance
    }

    public enum BiasStrength
    {
        VeryWeak,      // Score < 0
        Weak,          // Score 0-2
        Moderate,      // Score 3-5
        Strong,        // Score 6-8
        VeryStrong     // Score 9+
    }

    public class DailyContext
    {
        public BiasDirection DailyBias { get; set; }
        public BiasDirection WeeklyBias { get; set; }
        public double NearestDailySupport { get; set; }
        public double NearestDailyResistance { get; set; }
        public string SupportType { get; set; }  // "PDL", "FVG", "OrderBlock", etc.
        public string ResistanceType { get; set; }
        public bool IsDailyTrending { get; set; }  // True if clear HH/HL or LL/LH
        public DateTime LastUpdate { get; set; }
    }

    public class IntradayContext
    {
        public BiasDirection M15Bias { get; set; }
        public bool M15HasMSS { get; set; }  // Recent M15 MSS detected
        public DateTime? LastM15MSS { get; set; }
        public PO3Phase CurrentPO3Phase { get; set; }
        public double AsiaHigh { get; set; }
        public double AsiaLow { get; set; }
        public double SessionHigh { get; set; }  // Current session
        public double SessionLow { get; set; }
        public bool SweepDetected { get; set; }
        public string SweepType { get; set; }  // "Asia", "PDH", "PDL", etc.
        public DateTime LastUpdate { get; set; }
    }

    public class BiasConfluence
    {
        public int Score { get; set; }  // -5 to +10 range
        public BiasDirection Direction { get; set; }
        public BiasStrength Strength { get; set; }
        public List<string> Reasons { get; set; }  // Explainable reasons for score
        public KeyLevelInteractionType KeyLevelInteraction { get; set; }
        public bool HighProbabilitySetup { get; set; }  // Score >= 6
        public string Narrative { get; set; }  // Human-readable context

        public BiasConfluence()
        {
            Reasons = new List<string>();
        }
    }

    public enum PO3Phase
    {
        Accumulation,    // 00:00-08:00 UTC (Asia session)
        Manipulation,    // 08:00-13:00 UTC (London open + sweeps)
        Distribution     // 13:00-20:00 UTC (NY session + trend)
    }

    public class MTFBiasSystem
    {
        private readonly Robot _robot;
        private readonly MarketDataProvider _dataProvider;
        private readonly bool _enableDebugLogging;

        // Context storage
        private DailyContext _dailyContext;
        private IntradayContext _intradayContext;

        // Timeframe bars
        private Bars _dailyBars;
        private Bars _weeklyBars;
        private Bars _m15Bars;

        public MTFBiasSystem(Robot robot, MarketDataProvider dataProvider, bool enableDebugLogging = false)
        {
            _robot = robot;
            _dataProvider = dataProvider;
            _enableDebugLogging = enableDebugLogging;

            // Initialize timeframe bars
            _dailyBars = robot.MarketData.GetBars(TimeFrame.Daily);
            _weeklyBars = robot.MarketData.GetBars(TimeFrame.Weekly);
            _m15Bars = robot.MarketData.GetBars(TimeFrame.Minute15);

            // Initialize contexts
            _dailyContext = new DailyContext();
            _intradayContext = new IntradayContext();

            if (_enableDebugLogging)
                _robot.Print("[MTF BIAS] Multi-Timeframe Bias System initialized (Daily → M15 confluence)");
        }

        /// <summary>
        /// Step 1: Establish Daily Narrative (Top-Down Analysis)
        /// Call this once per day or when Daily bar closes
        /// </summary>
        public void UpdateDailyContext()
        {
            if (_dailyBars == null || _dailyBars.Count < 20) return;

            // 1. Daily Structure Bias
            BiasDirection dailyBias = _dataProvider.GetBias(TimeFrame.Daily);
            bool isDailyTrending = CheckIfTrending(_dailyBars, 20);

            // 2. Weekly Context
            BiasDirection weeklyBias = BiasDirection.Neutral;
            if (_weeklyBars != null && _weeklyBars.Count > 5)
                weeklyBias = _dataProvider.GetBias(TimeFrame.Weekly);

            // 3. Daily Key Levels
            double nearestSupport = FindNearestDailySupport(_dailyBars);
            double nearestResistance = FindNearestDailyResistance(_dailyBars);

            // Update context
            _dailyContext.DailyBias = dailyBias;
            _dailyContext.WeeklyBias = weeklyBias;
            _dailyContext.NearestDailySupport = nearestSupport;
            _dailyContext.NearestDailyResistance = nearestResistance;
            _dailyContext.SupportType = "PDL/Daily_Swing_Low";
            _dailyContext.ResistanceType = "PDH/Daily_Swing_High";
            _dailyContext.IsDailyTrending = isDailyTrending;
            _dailyContext.LastUpdate = _robot.Server.Time;

            if (_enableDebugLogging)
            {
                _robot.Print($"[MTF BIAS] Daily Context Updated:");
                _robot.Print($"  Daily Bias: {dailyBias} | Trending: {isDailyTrending}");
                _robot.Print($"  Weekly Bias: {weeklyBias}");
                _robot.Print($"  Support: {nearestSupport:F5} ({_dailyContext.SupportType})");
                _robot.Print($"  Resistance: {nearestResistance:F5} ({_dailyContext.ResistanceType})");
            }
        }

        /// <summary>
        /// Step 2: Analyze M15 Intraday Dynamics
        /// Call this every M15 bar or on chart timeframe bar
        /// </summary>
        public void UpdateIntradayContext(List<MSSSignal> recentMSS, LiquiditySweep lastSweep)
        {
            if (_m15Bars == null || _m15Bars.Count < 10) return;

            // 1. M15 Structure
            BiasDirection m15Bias = _dataProvider.GetBias(TimeFrame.Minute15);

            // 2. M15 MSS Detection - Fixed: use Time property instead of Timestamp
            bool m15HasMSS = recentMSS != null && recentMSS.Any(mss =>
                _robot.Server.Time - mss.Time < TimeSpan.FromHours(2));
            DateTime? lastM15MSS = m15HasMSS ? recentMSS.OrderByDescending(m => m.Time).First().Time : (DateTime?)null;

            // 3. PO3 Phase
            PO3Phase currentPhase = GetPowerOfThreePhase(_robot.Server.Time);

            // 4. Session Liquidity - Fixed: use passed values or calculate from bars
            double asiaHigh = 0;
            double asiaLow = 0;

            // Try to get from sweep if available, otherwise calculate
            if (lastSweep != null)
            {
                asiaHigh = lastSweep.SweepCandleHigh;
                asiaLow = lastSweep.SweepCandleLow;
            }

            // Calculate session high/low - Fixed: use loop instead of Maximum/Minimum
            double sessionHigh = 0;
            double sessionLow = double.MaxValue;
            int lookback = Math.Min(20, _m15Bars.Count - 1);

            for (int i = 0; i < lookback; i++)
            {
                double high = _m15Bars.HighPrices.Last(i);
                double low = _m15Bars.LowPrices.Last(i);
                if (high > sessionHigh) sessionHigh = high;
                if (low < sessionLow) sessionLow = low;
            }

            // 5. Recent Sweep - Fixed: use Time property instead of Timestamp
            bool sweepDetected = lastSweep != null && _robot.Server.Time - lastSweep.Time < TimeSpan.FromMinutes(60);
            string sweepType = sweepDetected ? lastSweep.Label : "None";

            // Update context
            _intradayContext.M15Bias = m15Bias;
            _intradayContext.M15HasMSS = m15HasMSS;
            _intradayContext.LastM15MSS = lastM15MSS;
            _intradayContext.CurrentPO3Phase = currentPhase;
            _intradayContext.AsiaHigh = asiaHigh;
            _intradayContext.AsiaLow = asiaLow;
            _intradayContext.SessionHigh = sessionHigh;
            _intradayContext.SessionLow = sessionLow;
            _intradayContext.SweepDetected = sweepDetected;
            _intradayContext.SweepType = sweepType;
            _intradayContext.LastUpdate = _robot.Server.Time;

            if (_enableDebugLogging)
            {
                _robot.Print($"[MTF BIAS] Intraday Context Updated:");
                _robot.Print($"  M15 Bias: {m15Bias} | MSS: {m15HasMSS}");
                _robot.Print($"  PO3 Phase: {currentPhase}");
                _robot.Print($"  Sweep: {sweepDetected} ({sweepType})");
            }
        }

        /// <summary>
        /// Step 3: Calculate Confluence Score
        /// Returns comprehensive bias assessment with scoring and narrative
        /// </summary>
        public BiasConfluence CalculateConfluence(double currentPrice)
        {
            var confluence = new BiasConfluence();
            int score = 0;
            var reasons = new List<string>();

            // ══════════════════════════════════════════════════════════
            // 1. Daily/M15 Alignment (+2 / -1)
            // ══════════════════════════════════════════════════════════
            if (_dailyContext.DailyBias == _intradayContext.M15Bias && _dailyContext.DailyBias != BiasDirection.Neutral)
            {
                score += 2;
                reasons.Add($"✅ ALIGNMENT: Daily {_dailyContext.DailyBias} == M15 {_intradayContext.M15Bias} (+2)");
            }
            else if (_dailyContext.DailyBias != BiasDirection.Neutral && _intradayContext.M15Bias != BiasDirection.Neutral
                     && _dailyContext.DailyBias != _intradayContext.M15Bias)
            {
                score -= 1;
                reasons.Add($"⚠️ PULLBACK: Daily {_dailyContext.DailyBias} != M15 {_intradayContext.M15Bias} (-1)");
            }

            // ══════════════════════════════════════════════════════════
            // 2. Weekly/Daily Alignment (+1)
            // ══════════════════════════════════════════════════════════
            if (_dailyContext.WeeklyBias == _dailyContext.DailyBias && _dailyContext.WeeklyBias != BiasDirection.Neutral)
            {
                score += 1;
                reasons.Add($"✅ HTF ALIGNMENT: Weekly {_dailyContext.WeeklyBias} confirms Daily (+1)");
            }

            // ══════════════════════════════════════════════════════════
            // 3. PO3 Sweep + M15 MSS Confluence (+3)
            // ══════════════════════════════════════════════════════════
            if (_intradayContext.SweepDetected && _intradayContext.M15HasMSS &&
                _intradayContext.CurrentPO3Phase == PO3Phase.Manipulation)
            {
                // Check if M15 MSS direction aligns with Daily bias
                if (_intradayContext.M15Bias == _dailyContext.DailyBias)
                {
                    score += 3;
                    reasons.Add($"🚀 HIGH PROB PO3: {_intradayContext.SweepType} sweep → M15 MSS during Manipulation phase (+3)");
                }
            }

            // ══════════════════════════════════════════════════════════
            // 4. Key Level Interaction (+2 / -2)
            // ══════════════════════════════════════════════════════════
            KeyLevelInteractionType keyLevelInteraction = DetermineKeyLevelInteraction(currentPrice);
            confluence.KeyLevelInteraction = keyLevelInteraction;

            switch (keyLevelInteraction)
            {
                case KeyLevelInteractionType.RejectionAtSupport:
                    if (_dailyContext.DailyBias == BiasDirection.Bullish)
                    {
                        score += 2;
                        reasons.Add($"✅ KEY LEVEL: Rejection at Daily support {_dailyContext.NearestDailySupport:F5} (aligns with Daily Bullish) (+2)");
                    }
                    break;

                case KeyLevelInteractionType.RejectionAtResistance:
                    if (_dailyContext.DailyBias == BiasDirection.Bearish)
                    {
                        score += 2;
                        reasons.Add($"✅ KEY LEVEL: Rejection at Daily resistance {_dailyContext.NearestDailyResistance:F5} (aligns with Daily Bearish) (+2)");
                    }
                    break;

                case KeyLevelInteractionType.BreakAboveResistance:
                    if (_dailyContext.DailyBias == BiasDirection.Bullish)
                    {
                        score += 2;
                        reasons.Add($"✅ BREAKOUT: Strong break above {_dailyContext.NearestDailyResistance:F5} (confirms Daily Bullish) (+2)");
                    }
                    else
                    {
                        score -= 2;
                        reasons.Add($"❌ REVERSAL RISK: Break above resistance against Daily Bearish bias (-2)");
                    }
                    break;

                case KeyLevelInteractionType.BreakBelowSupport:
                    if (_dailyContext.DailyBias == BiasDirection.Bearish)
                    {
                        score += 2;
                        reasons.Add($"✅ BREAKDOWN: Strong break below {_dailyContext.NearestDailySupport:F5} (confirms Daily Bearish) (+2)");
                    }
                    else
                    {
                        score -= 2;
                        reasons.Add($"❌ REVERSAL RISK: Break below support against Daily Bullish bias (-2)");
                    }
                    break;
            }

            // ══════════════════════════════════════════════════════════
            // 5. PO3 Distribution Phase + M15 Alignment (+1)
            // ══════════════════════════════════════════════════════════
            if (_intradayContext.CurrentPO3Phase == PO3Phase.Distribution &&
                _intradayContext.M15Bias == _dailyContext.DailyBias)
            {
                score += 1;
                reasons.Add($"✅ DISTRIBUTION: NY session with M15 aligned to Daily bias (+1)");
            }

            // ══════════════════════════════════════════════════════════
            // 6. Daily Trending Context (+1)
            // ══════════════════════════════════════════════════════════
            if (_dailyContext.IsDailyTrending && _intradayContext.M15Bias == _dailyContext.DailyBias)
            {
                score += 1;
                reasons.Add($"✅ TRENDING: Clear Daily trend with M15 alignment (+1)");
            }

            // ══════════════════════════════════════════════════════════
            // Final Assessment
            // ══════════════════════════════════════════════════════════
            confluence.Score = score;
            confluence.Reasons = reasons;

            // Determine direction (use Daily as primary, M15 as confirmation)
            if (score >= 3)
                confluence.Direction = _dailyContext.DailyBias;
            else if (score >= 0)
                confluence.Direction = _intradayContext.M15Bias;
            else
                confluence.Direction = BiasDirection.Neutral;

            // Determine strength
            confluence.Strength = score >= 9 ? BiasStrength.VeryStrong :
                                 score >= 6 ? BiasStrength.Strong :
                                 score >= 3 ? BiasStrength.Moderate :
                                 score >= 0 ? BiasStrength.Weak :
                                             BiasStrength.VeryWeak;

            confluence.HighProbabilitySetup = score >= 6;

            // Generate narrative
            confluence.Narrative = GenerateNarrative(confluence, currentPrice);

            return confluence;
        }

        /// <summary>
        /// Generate human-readable narrative
        /// </summary>
        private string GenerateNarrative(BiasConfluence confluence, double currentPrice)
        {
            var sb = new StringBuilder();

            sb.AppendLine($"Daily: {_dailyContext.DailyBias} ({(_dailyContext.IsDailyTrending ? "Trending" : "Ranging")}).");
            sb.AppendLine($"M15: {_intradayContext.M15Bias} {(_intradayContext.M15HasMSS ? "(MSS confirmed)" : "")}.");
            sb.AppendLine($"Phase: {_intradayContext.CurrentPO3Phase}.");

            // Key level context
            double distToSupport = Math.Abs(currentPrice - _dailyContext.NearestDailySupport);
            double distToResistance = Math.Abs(_dailyContext.NearestDailyResistance - currentPrice);

            if (distToSupport < distToResistance)
                sb.AppendLine($"Context: Approaching Daily support at {_dailyContext.NearestDailySupport:F5}.");
            else
                sb.AppendLine($"Context: Approaching Daily resistance at {_dailyContext.NearestDailyResistance:F5}.");

            // Probability assessment
            if (confluence.HighProbabilitySetup)
                sb.AppendLine($"🚀 HIGH PROBABILITY: {confluence.Direction} setup with strong confluence.");
            else if (confluence.Score >= 3)
                sb.AppendLine($"✅ MODERATE PROBABILITY: {confluence.Direction} setup with decent confluence.");
            else if (confluence.Score >= 0)
                sb.AppendLine($"⚠️ LOW PROBABILITY: Weak confluence. Consider waiting.");
            else
                sb.AppendLine($"❌ CONFLICTING SIGNALS: Avoid trading.");

            sb.AppendLine($"Score: {confluence.Score}");

            return sb.ToString();
        }

        /// <summary>
        /// Determine key level interaction type
        /// </summary>
        private KeyLevelInteractionType DetermineKeyLevelInteraction(double currentPrice)
        {
            double pipSize = _robot.Symbol.PipSize;
            double distToSupport = (currentPrice - _dailyContext.NearestDailySupport) / pipSize;
            double distToResistance = (_dailyContext.NearestDailyResistance - currentPrice) / pipSize;

            // Check last 3 bars for wick/rejection
            bool hasLowerWick = false;
            bool hasUpperWick = false;

            if (_m15Bars != null && _m15Bars.Count > 3)
            {
                for (int i = 0; i < 3; i++)
                {
                    double body = Math.Abs(_m15Bars.ClosePrices.Last(i) - _m15Bars.OpenPrices.Last(i));
                    double lowerWick = Math.Min(_m15Bars.OpenPrices.Last(i), _m15Bars.ClosePrices.Last(i)) - _m15Bars.LowPrices.Last(i);
                    double upperWick = _m15Bars.HighPrices.Last(i) - Math.Max(_m15Bars.OpenPrices.Last(i), _m15Bars.ClosePrices.Last(i));

                    if (lowerWick > body * 1.5) hasLowerWick = true;
                    if (upperWick > body * 1.5) hasUpperWick = true;
                }
            }

            // Rejection at support (within 10 pips below support + lower wick)
            if (distToSupport >= -10 && distToSupport <= 5 && hasLowerWick)
                return KeyLevelInteractionType.RejectionAtSupport;

            // Rejection at resistance (within 10 pips above resistance + upper wick)
            if (distToResistance >= -10 && distToResistance <= 5 && hasUpperWick)
                return KeyLevelInteractionType.RejectionAtResistance;

            // Strong break above resistance (> 15 pips above)
            if (distToResistance < -15)
                return KeyLevelInteractionType.BreakAboveResistance;

            // Strong break below support (> 15 pips below)
            if (distToSupport < -15)
                return KeyLevelInteractionType.BreakBelowSupport;

            // Testing levels (within 5 pips)
            if (Math.Abs(distToSupport) <= 5)
                return KeyLevelInteractionType.TestingSupport;
            if (Math.Abs(distToResistance) <= 5)
                return KeyLevelInteractionType.TestingResistance;

            return KeyLevelInteractionType.None;
        }

        /// <summary>
        /// Check if timeframe is trending
        /// </summary>
        private bool CheckIfTrending(Bars bars, int lookback)
        {
            if (bars == null || bars.Count < lookback) return false;

            // Simple trend check: compare closes over lookback period
            int upBars = 0;
            int downBars = 0;

            for (int i = 1; i < lookback; i++)
            {
                if (bars.ClosePrices.Last(i) > bars.ClosePrices.Last(i + 1))
                    upBars++;
                else
                    downBars++;
            }

            // Trending if > 60% bars in one direction
            return (upBars > lookback * 0.6) || (downBars > lookback * 0.6);
        }

        /// <summary>
        /// Find nearest Daily support (simplified - uses recent swing low)
        /// </summary>
        private double FindNearestDailySupport(Bars dailyBars)
        {
            if (dailyBars == null || dailyBars.Count < 10) return 0;

            // Find lowest low in last 10 days - Fixed: use loop
            double lowestLow = double.MaxValue;
            for (int i = 0; i < 10; i++)
            {
                double low = dailyBars.LowPrices.Last(i);
                if (low < lowestLow) lowestLow = low;
            }
            return lowestLow;
        }

        /// <summary>
        /// Find nearest Daily resistance (simplified - uses recent swing high)
        /// </summary>
        private double FindNearestDailyResistance(Bars dailyBars)
        {
            if (dailyBars == null || dailyBars.Count < 10) return 999999;

            // Find highest high in last 10 days - Fixed: use loop
            double highestHigh = 0;
            for (int i = 0; i < 10; i++)
            {
                double high = dailyBars.HighPrices.Last(i);
                if (high > highestHigh) highestHigh = high;
            }
            return highestHigh;
        }

        /// <summary>
        /// Determine PO3 phase based on UTC time
        /// </summary>
        private PO3Phase GetPowerOfThreePhase(DateTime utcTime)
        {
            TimeSpan time = utcTime.TimeOfDay;

            if (time >= new TimeSpan(0, 0, 0) && time < new TimeSpan(8, 0, 0))
                return PO3Phase.Accumulation;
            else if (time >= new TimeSpan(8, 0, 0) && time < new TimeSpan(13, 0, 0))
                return PO3Phase.Manipulation;
            else
                return PO3Phase.Distribution;
        }

        /// <summary>
        /// Get session start time for current session
        /// </summary>
        private DateTime GetSessionStartTime(DateTime currentTime)
        {
            TimeSpan time = currentTime.TimeOfDay;

            if (time < new TimeSpan(8, 0, 0))
                return currentTime.Date; // Asia session start
            else if (time < new TimeSpan(13, 0, 0))
                return currentTime.Date.Add(new TimeSpan(8, 0, 0)); // London session start
            else
                return currentTime.Date.Add(new TimeSpan(13, 0, 0)); // NY session start
        }

        /// <summary>
        /// Get current contexts for external access
        /// </summary>
        public DailyContext GetDailyContext() => _dailyContext;
        public IntradayContext GetIntradayContext() => _intradayContext;
    }
}
