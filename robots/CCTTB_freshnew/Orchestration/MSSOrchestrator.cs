using cAlgo.API;
using cAlgo.API.Internals;
using System;
using System.Collections.Generic;
using System.Linq;

namespace CCTTB
{
    /// <summary>
    /// MSS ORCHESTRATOR - Dual-timeframe MSS integration (15M bias → 5M entry)
    /// Implements: HTF_MSS → Validation Window → LTF_CONFIRM → Policy Gates → Trade
    /// State Flow: Idle → HTF_AwaitLTF → ReadyToFire → InTrade → Cooldown
    /// </summary>
    public class MSSOrchestrator
    {
        private readonly Robot _bot;
        private readonly Symbol _symbol;
        private readonly MSSPolicyConfig _policy;

        // State management
        private MSSContext _context;
        private MSSState _state;
        private DateTime _stateEntryTime;
        private DateTime _cooldownUntil;

        // Statistics
        private int _totalHTFSignals = 0;
        private int _totalLTFConfirms = 0;
        private int _totalTrades = 0;
        private int _rejectedByGates = 0;

        public enum MSSState
        {
            Idle,               // No active signal
            HTF_AwaitLTF,      // 15M MSS detected, waiting for 5M confirm
            ReadyToFire,        // Both HTF and LTF aligned, ready to trade
            InTrade,            // Position active
            Cooldown            // Post-trade cooldown period
        }

        public class MSSContext
        {
            // HTF (15M) signal data
            public string Side { get; set; }  // "bullish" | "bearish"
            public HTFPOI POI { get; set; }
            public string SweepRef { get; set; }
            public DisplacementData Displacement { get; set; }
            public StructBreak StructureBreak { get; set; }
            public DateTime ValidUntil { get; set; }
            public DateTime DetectedAt { get; set; }

            // LTF (5M) confirmation data
            public LTFConfirmation LTFConfirm { get; set; }

            // Scoring
            public double Score { get; set; }
            public Dictionary<string, double> ScoreBreakdown { get; set; }
        }

        public class HTFPOI
        {
            public string Type { get; set; }  // "OB" | "FVG" | "Breaker"
            public double PriceTop { get; set; }
            public double PriceBottom { get; set; }
            public double Quality { get; set; }  // 0-1 freshness/overlap
            public DateTime CreatedAt { get; set; }
        }

        public class DisplacementData
        {
            public double BodyFactor { get; set; }  // Close-to-close displacement
            public double GapSize { get; set; }     // FVG size
            public double ATRz { get; set; }        // Z-score vs ATR
            public double Size { get; set; }        // Alias for BodyFactor (for detector compatibility)
            public double ATRMultiple { get; set; } // ATR multiple (for detector compatibility)
            public bool HasFVG { get; set; }        // FVG present flag
            public double FVGSize { get; set; }     // Alias for GapSize
        }

        public class StructBreak
        {
            public string BrokenRef { get; set; }  // "HL" | "LH"
            public double ClosePrice { get; set; }
            public double BreakLevel { get; set; }
            public double Level { get; set; }       // Alias for BreakLevel (for detector compatibility)
            public double Distance { get; set; }     // Distance in price
            public double DistancePips { get; set; } // Distance in pips
        }

        public class LTFConfirmation
        {
            public string Side { get; set; }
            public double EntryPrice { get; set; }
            public double StopLoss { get; set; }
            public double TakeProfit { get; set; }
            public bool InsidePOI { get; set; }
            public DateTime ConfirmedAt { get; set; }
        }

        public class LTFPOI
        {
            public double Top { get; set; }
            public double Bottom { get; set; }
            public string Type { get; set; }  // "OrderBlock" | "OTEZone"
        }

        public MSSOrchestrator(Robot bot, Symbol symbol, MSSPolicyConfig policy)
        {
            _bot = bot;
            _symbol = symbol;
            _policy = policy;
            _state = MSSState.Idle;
            _stateEntryTime = DateTime.MinValue;
            _cooldownUntil = DateTime.MinValue;
        }

        /// <summary>
        /// ON HTF MSS - Called when 15M MSS detected
        /// Opens validation window for 5M confirmation
        /// </summary>
        public void OnHTFMSS(
            string side,
            HTFPOI poi,
            string sweepRef,
            DisplacementData displacement,
            StructBreak structBreak)
        {
            _totalHTFSignals++;

            // Check if in cooldown
            if (_state == MSSState.Cooldown && DateTime.Now < _cooldownUntil)
            {
                if (_policy.EnableDebugLogging)
                    _bot.Print($"[MSS HTF] Rejected - In cooldown until {_cooldownUntil:HH:mm:ss}");
                return;
            }

            // Validate HTF signal strength
            if (!ValidateHTFSignal(displacement, structBreak))
            {
                if (_policy.EnableDebugLogging)
                    _bot.Print($"[MSS HTF] Rejected - Failed validation (disp={displacement.BodyFactor:F2}, atrZ={displacement.ATRz:F2})");
                return;
            }

            // Create new context
            _context = new MSSContext
            {
                Side = side,
                POI = poi,
                SweepRef = sweepRef,
                Displacement = displacement,
                StructureBreak = structBreak,
                DetectedAt = DateTime.Now,
                ValidUntil = DateTime.Now.AddMinutes(_policy.HTF.WindowCandles * 15), // 15M candles
                ScoreBreakdown = new Dictionary<string, double>()
            };

            // Transition to awaiting LTF
            TransitionState(MSSState.HTF_AwaitLTF);

            if (_policy.EnableDebugLogging)
            {
                _bot.Print($"[MSS HTF] {side.ToUpper()} signal detected");
                _bot.Print($"[MSS HTF] POI: {poi.Type} [{poi.PriceBottom:F5} - {poi.PriceTop:F5}]");
                _bot.Print($"[MSS HTF] Displacement: body={displacement.BodyFactor:F2}, gap={displacement.GapSize:F5}, atrZ={displacement.ATRz:F2}");
                _bot.Print($"[MSS HTF] Valid until: {_context.ValidUntil:HH:mm:ss} ({_policy.HTF.WindowCandles} candles)");
            }
        }

        /// <summary>
        /// ON LTF CONFIRM - Called when 5M MSS detected
        /// Validates alignment with HTF and triggers trade if passed
        /// </summary>
        public bool OnLTFConfirm(
            string side,
            double entryPrice,
            double stopLoss,
            double takeProfit)
        {
            _totalLTFConfirms++;

            // Must be waiting for LTF
            if (_state != MSSState.HTF_AwaitLTF)
            {
                if (_policy.EnableDebugLogging)
                    _bot.Print($"[MSS LTF] Ignored - Not awaiting LTF (state={_state})");
                return false;
            }

            // Check window expiry
            if (DateTime.Now > _context.ValidUntil)
            {
                if (_policy.EnableDebugLogging)
                    _bot.Print($"[MSS LTF] Rejected - Window expired");
                TransitionState(MSSState.Idle);
                return false;
            }

            // Validate side alignment
            if (!_policy.Alignment.RequireSameSide || side != _context.Side)
            {
                if (_policy.EnableDebugLogging)
                    _bot.Print($"[MSS LTF] Rejected - Side mismatch (HTF={_context.Side}, LTF={side})");
                return false;
            }

            // Check if entry is inside HTF POI
            bool insidePOI = entryPrice >= _context.POI.PriceBottom && entryPrice <= _context.POI.PriceTop;
            if (_policy.LTF.RefinePOI && !insidePOI)
            {
                if (_policy.EnableDebugLogging)
                    _bot.Print($"[MSS LTF] Rejected - Entry {entryPrice:F5} outside POI [{_context.POI.PriceBottom:F5}-{_context.POI.PriceTop:F5}]");
                return false;
            }

            // Store LTF confirmation
            _context.LTFConfirm = new LTFConfirmation
            {
                Side = side,
                EntryPrice = entryPrice,
                StopLoss = stopLoss,
                TakeProfit = takeProfit,
                InsidePOI = insidePOI,
                ConfirmedAt = DateTime.Now
            };

            // Compute score
            _context.Score = ComputeScore();

            // Validate through gates
            if (!ValidatePolicyGates())
            {
                _rejectedByGates++;
                return false;
            }

            // All checks passed - ready to fire
            TransitionState(MSSState.ReadyToFire);

            if (_policy.EnableDebugLogging)
            {
                _bot.Print($"[MSS LTF] ✅ CONFIRMED - {side.ToUpper()} signal aligned with HTF");
                _bot.Print($"[MSS LTF] Entry: {entryPrice:F5}, SL: {stopLoss:F5}, TP: {takeProfit:F5}");
                _bot.Print($"[MSS LTF] Score: {_context.Score:F2} | Breakdown: {GetScoreBreakdownString()}");
            }

            _totalTrades++;
            return true;
        }

        /// <summary>
        /// ON OPPOSITE HTF MSS - Cancels current context
        /// </summary>
        public void OnOppositeHTFMSS(string newSide)
        {
            if (_context != null && _context.Side != newSide)
            {
                if (_policy.EnableDebugLogging)
                    _bot.Print($"[MSS HTF] CANCELLED - Opposite HTF MSS detected ({_context.Side} → {newSide})");

                if (_policy.Alignment.CancelOnOppositeHTF)
                {
                    TransitionState(MSSState.Idle);
                }
            }
        }

        /// <summary>
        /// UPDATE - Called on each bar to manage state transitions and timers
        /// </summary>
        public void Update()
        {
            // Check HTF window expiry
            if (_state == MSSState.HTF_AwaitLTF && DateTime.Now > _context.ValidUntil)
            {
                if (_policy.EnableDebugLogging)
                    _bot.Print($"[MSS] HTF window expired - resetting to Idle");
                TransitionState(MSSState.Idle);
            }

            // Check cooldown expiry
            if (_state == MSSState.Cooldown && DateTime.Now >= _cooldownUntil)
            {
                if (_policy.EnableDebugLogging)
                    _bot.Print($"[MSS] Cooldown expired - ready for new signals");
                TransitionState(MSSState.Idle);
            }
        }

        /// <summary>
        /// ON TRADE CLOSED - Transitions to cooldown
        /// </summary>
        public void OnTradeClosed(bool wasWinner)
        {
            if (_state == MSSState.InTrade)
            {
                int cooldownMin = wasWinner ? 5 : _policy.Cooldowns.AfterLossMin;
                _cooldownUntil = DateTime.Now.AddMinutes(cooldownMin);

                if (_policy.EnableDebugLogging)
                    _bot.Print($"[MSS] Trade closed ({(wasWinner ? "WIN" : "LOSS")}) - cooldown until {_cooldownUntil:HH:mm:ss}");

                TransitionState(MSSState.Cooldown);
            }
        }

        /// <summary>
        /// VALIDATE HTF SIGNAL - Checks minimum displacement criteria
        /// </summary>
        private bool ValidateHTFSignal(DisplacementData disp, StructBreak structBreak)
        {
            // Check minimum body factor
            if (disp.BodyFactor < _policy.HTF.MinDispBodyFactor)
                return false;

            // Check minimum ATR z-score
            if (disp.ATRz < _policy.HTF.MinAtrZ)
                return false;

            // Require body close beyond structure
            if (structBreak.ClosePrice == 0)
                return false;

            return true;
        }

        /// <summary>
        /// COMPUTE SCORE - Multi-factor scoring (0-100 scale)
        /// </summary>
        private double ComputeScore()
        {
            var breakdown = _context.ScoreBreakdown;

            // Factor 1: Displacement strength (0-30 points)
            double dispScore = Math.Min(30, (_context.Displacement.BodyFactor / 2.0) * 15 +
                                            (_context.Displacement.ATRz / 2.0) * 15);
            breakdown["displacement"] = dispScore;

            // Factor 2: HTF-LTF alignment (20 points if aligned)
            double alignScore = _context.LTFConfirm.Side == _context.Side ? 20 : 0;
            breakdown["alignment"] = alignScore;

            // Factor 3: POI quality (0-20 points)
            double poiScore = _context.POI.Quality * 20;
            breakdown["poi_quality"] = poiScore;

            // Factor 4: Inside POI bonus (10 points)
            double insidePOIScore = _context.LTFConfirm.InsidePOI ? 10 : 0;
            breakdown["inside_poi"] = insidePOIScore;

            // Factor 5: POI freshness (0-10 points)
            double ageMin = (DateTime.Now - _context.POI.CreatedAt).TotalMinutes;
            double freshnessScore = Math.Max(0, 10 * (1 - ageMin / _policy.POI.MaxAgingMin));
            breakdown["freshness"] = freshnessScore;

            // Factor 6: Structure break quality (0-10 points)
            double structScore = _context.StructureBreak.BrokenRef != null ? 10 : 0;
            breakdown["structure"] = structScore;

            // Total score
            double totalScore = dispScore + alignScore + poiScore + insidePOIScore + freshnessScore + structScore;
            return totalScore;
        }

        /// <summary>
        /// VALIDATE POLICY GATES - Final approval checks
        /// </summary>
        private bool ValidatePolicyGates()
        {
            // Gate 1: Minimum RR
            double rr = CalculateRR();
            if (rr < _policy.Risk.MinRR)
            {
                if (_policy.EnableDebugLogging)
                    _bot.Print($"[MSS GATE] Rejected - RR too low ({rr:F2} < {_policy.Risk.MinRR:F2})");
                return false;
            }

            // Gate 2: Session filter
            var currentSession = GetCurrentSession();
            if (!_policy.Filters.Session.Contains(currentSession))
            {
                if (_policy.EnableDebugLogging)
                    _bot.Print($"[MSS GATE] Rejected - Session not allowed ({currentSession})");
                return false;
            }

            // Gate 3: Max concurrent per symbol
            // (Would check actual position count here)

            // Gate 4: Daily limit
            // (Would check trades today count here)

            return true;
        }

        /// <summary>
        /// Helper methods
        /// </summary>
        private double CalculateRR()
        {
            if (_context.LTFConfirm == null) return 0;

            double risk = Math.Abs(_context.LTFConfirm.EntryPrice - _context.LTFConfirm.StopLoss);
            double reward = Math.Abs(_context.LTFConfirm.TakeProfit - _context.LTFConfirm.EntryPrice);

            return risk > 0 ? reward / risk : 0;
        }

        private string GetCurrentSession()
        {
            var utcHour = DateTime.UtcNow.Hour;
            if (utcHour >= 0 && utcHour < 8) return "asia";
            if (utcHour >= 8 && utcHour < 13) return "london";
            if (utcHour >= 13 && utcHour < 17) return "overlap";
            if (utcHour >= 17 && utcHour < 24) return "newyork";
            return "unknown";
        }

        private void TransitionState(MSSState newState)
        {
            var oldState = _state;
            _state = newState;
            _stateEntryTime = DateTime.Now;

            if (_policy.EnableDebugLogging)
                _bot.Print($"[MSS STATE] {oldState} → {newState}");
        }

        private string GetScoreBreakdownString()
        {
            if (_context.ScoreBreakdown == null || _context.ScoreBreakdown.Count == 0)
                return "N/A";

            var parts = _context.ScoreBreakdown.Select(kvp => $"{kvp.Key}={kvp.Value:F1}");
            return string.Join(", ", parts);
        }

        // Public getters
        public MSSState GetState() => _state;
        public MSSContext GetContext() => _context;
        public bool IsReadyToFire() => _state == MSSState.ReadyToFire;
        public string GetStatistics() =>
            $"HTF:{_totalHTFSignals} | LTF:{_totalLTFConfirms} | Trades:{_totalTrades} | Rejected:{_rejectedByGates}";
    }

    /// <summary>
    /// MSS POLICY CONFIG - Loaded from JSON
    /// </summary>
    public class MSSPolicyConfig
    {
        public bool Enabled { get; set; } = true;
        public bool EnableDebugLogging { get; set; } = false;

        public HTFConfig HTF { get; set; } = new HTFConfig();
        public LTFConfig LTF { get; set; } = new LTFConfig();
        public POIConfig POI { get; set; } = new POIConfig();
        public AlignmentConfig Alignment { get; set; } = new AlignmentConfig();
        public RiskConfig Risk { get; set; } = new RiskConfig();
        public FiltersConfig Filters { get; set; } = new FiltersConfig();
        public CooldownsConfig Cooldowns { get; set; } = new CooldownsConfig();
        public LimitsConfig Limits { get; set; } = new LimitsConfig();

        public class HTFConfig
        {
            public string TF { get; set; } = "15m";
            public int WindowCandles { get; set; } = 8;
            public double MinDispBodyFactor { get; set; } = 1.25;
            public double MinAtrZ { get; set; } = 0.8;
        }

        public class LTFConfig
        {
            public string TF { get; set; } = "5m";
            public int ConfirmWithinCandles { get; set; } = 10;
            public bool RequireLocalSweep { get; set; } = true;
            public double MinCloseBeyond { get; set; } = 0.05;
            public bool RefinePOI { get; set; } = true;
        }

        public class POIConfig
        {
            public List<string> Prefer { get; set; } = new List<string> { "OB", "FVG", "Breaker" };
            public bool FreshOnly { get; set; } = true;
            public int MaxAgingMin { get; set; } = 360;
        }

        public class AlignmentConfig
        {
            public bool RequireSameSide { get; set; } = true;
            public bool CancelOnOppositeHTF { get; set; } = true;
        }

        public class RiskConfig
        {
            public double MinRR { get; set; } = 2.0;
            public bool UseATRsl { get; set; } = true;
            public int AtrPeriod { get; set; } = 14;
            public double AtrSLmult { get; set; } = 1.2;
            public string TpMode { get; set; } = "multiple";
            public List<double> TpR { get; set; } = new List<double> { 1.0, 2.0, 3.0 };
            public List<double> PartialPerc { get; set; } = new List<double> { 0.3, 0.3, 0.4 };
            public double MoveToBEatR { get; set; } = 1.2;
            public double TrailAfterR { get; set; } = 1.5;
            public string TrailMode { get; set; } = "atr";
            public double TrailMult { get; set; } = 1.0;
        }

        public class FiltersConfig
        {
            public List<string> Session { get; set; } = new List<string> { "london", "overlap", "newyork" };
            public double MaxSpreadZ { get; set; } = 1.0;
            public int VolStabilityLookback { get; set; } = 240;
            public int BanNewsMinBefore { get; set; } = 10;
            public int BanNewsMinAfter { get; set; } = 10;
        }

        public class CooldownsConfig
        {
            public int AfterLossMin { get; set; } = 20;
            public int AfterMissedEntryMin { get; set; } = 10;
        }

        public class LimitsConfig
        {
            public int MaxConcurrentPerSymbol { get; set; } = 1;
            public int MaxTotalDaily { get; set; } = 4;
        }
    }
}