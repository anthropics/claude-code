using cAlgo.API;
using cAlgo.API.Internals;
using cAlgo.API.Indicators;
using System;
using System.Collections.Generic;
using System.Linq;

namespace CCTTB
{
    // CRITICAL FIX (Oct 25): Proper ICT HTF bias confirmation sequence
    public enum BiasState
    {
        IDLE,                    // No bias established
        HTF_BIAS_SET,           // HTF bias determined from 4H/Daily candles
        AWAITING_SWEEP,         // Waiting for liquidity sweep in opposite direction
        SWEEP_DETECTED,         // Sweep occurred, waiting for MSS with displacement
        MSS_CONFIRMED,          // MSS with FVG/displacement confirmed
        READY_FOR_ENTRY,        // Ready for OTE pullback entry
        INVALIDATED             // Bias invalidated - wait for new HTF setup
    }

    public enum ConfidenceLevel
    {
        Low = 1,
        Base = 2,
        High = 3
    }

    // CRITICAL (Oct 25): Power of Three phases
    public enum PowerOfThreePhase
    {
        Accumulation,   // Asian session - establish initial bias
        Manipulation,   // London - sweep opposite liquidity
        Distribution    // NY - continue in bias direction
    }

    public class SweepEvent
    {
        public DateTime Time { get; set; }
        public string Direction { get; set; } // "up" or "down"
        public string RefLabel { get; set; }
        public double RefLevel { get; set; }
        public double SweepPrice { get; set; }
        public double ClosePrice { get; set; }
        public double Displacement { get; set; }
    }

    public class BiasStateMachine
    {
        private readonly Robot _bot;
        private readonly cAlgo.API.Internals.Symbol _symbol;
        private readonly HtfDataProvider _htfData;
        private readonly LiquidityReferenceManager _refManager;
        private readonly OrchestratorGate _gate;
        private readonly StrategyConfig _config;

        // State variables
        private BiasState _state = BiasState.IDLE;
        private BiasDirection? _candidateBias = null;
        private BiasDirection? _confirmedBias = null;
        private ConfidenceLevel _confidence = ConfidenceLevel.Base;
        private DateTime _candidateTime;
        private SweepEvent _lastSweep = null;
        private TimeFrame _htfPrimary;
        private TimeFrame _htfSecondary;

        // Thresholds (ATR-based)
        private double _breakFactor = 0.25;
        private int _confirmBars = 3;
        private double _dispMult = 0.75;
        private double _flipThresh = 1.0;
        private int _confirmWindowMin = 300; // 5 hours

        // ATR indicator
        private AverageTrueRange _atrIndicator;

        public BiasStateMachine(
            Robot bot,
            cAlgo.API.Internals.Symbol symbol,
            HtfDataProvider htfData,
            LiquidityReferenceManager refManager,
            OrchestratorGate gate,
            StrategyConfig config)
        {
            _bot = bot;
            _symbol = symbol;
            _htfData = htfData;
            _refManager = refManager;
            _gate = gate;
            _config = config;

            // Initialize ATR (14-period on chart timeframe)
            _atrIndicator = _bot.Indicators.AverageTrueRange(14, MovingAverageType.Simple);
        }

        public void Initialize(TimeFrame htfPrimary, TimeFrame htfSecondary)
        {
            _htfPrimary = htfPrimary;
            _htfSecondary = htfSecondary;
            Reset();
            _bot.Print($"[BiasStateMachine] Initialized with HTF {htfPrimary}/{htfSecondary}");
        }

        public void Reset()
        {
            _state = BiasState.IDLE;
            _candidateBias = null;
            // CRITICAL FIX (Oct 25): Don't clear confirmed bias on reset
            // HTF Power of Three: bias persists throughout trading day once established
            // Only clear if explicitly requested or at daily reset
            // _confirmedBias = null;  // REMOVED - keep last confirmed bias
            _confidence = ConfidenceLevel.Base;
            _lastSweep = null;
            _bot.Print($"[BiasStateMachine] Reset to IDLE (keeping bias: {_confirmedBias})");
        }

        // ═══════════════════════════════════════════════════════════════════
        // PUBLIC API
        // ═══════════════════════════════════════════════════════════════════

        public BiasState GetState() => _state;
        public BiasDirection? GetCandidateBias() => _candidateBias;
        public BiasDirection? GetConfirmedBias() => _confirmedBias;
        public ConfidenceLevel GetConfidence() => _confidence;
        public bool IsMssAllowed() => _state == BiasState.SWEEP_DETECTED || _state == BiasState.MSS_CONFIRMED;
        public bool IsEntryAllowed() => _state == BiasState.READY_FOR_ENTRY;

        /// <summary>
        /// CRITICAL FIX (Oct 25): Explicit daily reset method for new trading day
        /// Call this at Asia session start or daily boundary to clear bias
        /// </summary>
        public void DailyReset()
        {
            _state = BiasState.IDLE;
            _candidateBias = null;
            _confirmedBias = null;  // Clear bias for new day
            _confidence = ConfidenceLevel.Base;
            _lastSweep = null;
            _bot.Print("[BiasStateMachine] Daily Reset - All bias cleared for new trading day");
        }

        /// <summary>
        /// Main update method - call on every bar
        /// </summary>
        public void OnBar()
        {
            var bars = _bot.Bars;
            if (bars == null || bars.Count < 20) return;

            double atrValue = _atrIndicator.Result.LastValue;
            if (double.IsNaN(atrValue) || atrValue <= 0) return;

            // CRITICAL FIX (Oct 25): Check HTF Power of Three bias first
            if (_confirmedBias == null || _state == BiasState.IDLE)
            {
                CheckHTFPowerOfThreeBias();
            }

            // CRITICAL FIX (Oct 25): Proper ICT sequence: HTF Bias → Sweep → MSS → Entry
            switch (_state)
            {
                case BiasState.IDLE:
                    // First establish HTF bias from 4H/Daily
                    if (_confirmedBias != null)
                        _state = BiasState.HTF_BIAS_SET;
                    break;

                case BiasState.HTF_BIAS_SET:
                    // HTF bias confirmed, now wait for liquidity sweep
                    _state = BiasState.AWAITING_SWEEP;
                    if (_config.EnableDebugLogging)
                        _bot.Print($"[ICT Sequence] HTF Bias Set: {_confirmedBias} | Awaiting liquidity sweep");
                    break;

                case BiasState.AWAITING_SWEEP:
                    // Look for liquidity sweep opposite to bias direction
                    CheckForLiquiditySweep(bars, atrValue);
                    break;

                case BiasState.SWEEP_DETECTED:
                    // Sweep occurred, now wait for MSS with displacement
                    CheckForMSSWithDisplacement(bars, atrValue);
                    break;

                case BiasState.MSS_CONFIRMED:
                    // MSS confirmed, ready for OTE pullback entries
                    _state = BiasState.READY_FOR_ENTRY;
                    _gate.OpenGate("ENTRY", "mss_confirmed_with_displacement");
                    if (_config.EnableDebugLogging)
                        _bot.Print($"[ICT Sequence] MSS Confirmed | Ready for OTE entries");
                    break;

                case BiasState.READY_FOR_ENTRY:
                    // Maintain readiness for entries
                    CheckInvalidation(bars, atrValue);
                    break;

                case BiasState.INVALIDATED:
                    Reset(); // Auto-reset to IDLE
                    break;
            }
        }

        /// <summary>
        /// CRITICAL (Oct 25): Determine bias from HTF Power of Three pattern
        /// Uses 4H/Daily candles to establish directional bias for the trading day
        /// </summary>
        private void CheckHTFPowerOfThreeBias()
        {
            // Get HTF candles (4H for M5, Daily for M15)
            var htfBars = _htfData.GetHtfBars(_htfSecondary);
            if (htfBars == null || htfBars.Count < 3) return;

            // Look at last 2 completed HTF candles for bias
            int idx = htfBars.Count - 2; // Last completed candle
            if (idx < 1) return;

            double htfOpen = htfBars.OpenPrices[idx];
            double htfClose = htfBars.ClosePrices[idx];
            double htfHigh = htfBars.HighPrices[idx];
            double htfLow = htfBars.LowPrices[idx];

            // Previous HTF candle
            double prevOpen = htfBars.OpenPrices[idx - 1];
            double prevClose = htfBars.ClosePrices[idx - 1];
            double prevHigh = htfBars.HighPrices[idx - 1];
            double prevLow = htfBars.LowPrices[idx - 1];

            // Determine Power of Three phase based on time
            var utcNow = _bot.Server.Time.ToUniversalTime();
            var phase = GetPowerOfThreePhase(utcNow);

            // Bullish HTF structure: Higher highs, higher lows, bullish close
            bool htfBullish = htfClose > htfOpen &&
                              htfHigh > prevHigh &&
                              htfLow > prevLow &&
                              htfClose > prevClose;

            // Bearish HTF structure: Lower highs, lower lows, bearish close
            bool htfBearish = htfClose < htfOpen &&
                              htfHigh < prevHigh &&
                              htfLow < prevLow &&
                              htfClose < prevClose;

            // During accumulation phase, establish initial bias
            if (phase == PowerOfThreePhase.Accumulation && _confirmedBias == null)
            {
                if (htfBullish)
                {
                    _confirmedBias = BiasDirection.Bullish;
                    _state = BiasState.HTF_BIAS_SET;
                    _confidence = ConfidenceLevel.High;
                    if (_config.EnableDebugLogging)
                        _bot.Print($"[HTF Power of Three] Bullish bias established from {_htfSecondary} structure");
                }
                else if (htfBearish)
                {
                    _confirmedBias = BiasDirection.Bearish;
                    _state = BiasState.HTF_BIAS_SET;
                    _confidence = ConfidenceLevel.High;
                    if (_config.EnableDebugLogging)
                        _bot.Print($"[HTF Power of Three] Bearish bias established from {_htfSecondary} structure");
                }
            }
        }

        /// <summary>
        /// Determine current Power of Three phase based on UTC time
        /// </summary>
        private PowerOfThreePhase GetPowerOfThreePhase(DateTime utcTime)
        {
            int hour = utcTime.Hour;

            // Asian session (00:00 - 09:00 UTC) - Accumulation
            if (hour >= 0 && hour < 9)
                return PowerOfThreePhase.Accumulation;

            // London session (09:00 - 13:00 UTC) - Manipulation
            if (hour >= 9 && hour < 13)
                return PowerOfThreePhase.Manipulation;

            // NY session (13:00 - 24:00 UTC) - Distribution
            return PowerOfThreePhase.Distribution;
        }

        // ═══════════════════════════════════════════════════════════════════
        // STATE TRANSITIONS
        // ═══════════════════════════════════════════════════════════════════

        /// <summary>
        /// OLD METHOD - No longer used in new ICT sequence flow
        /// Kept for reference - will be removed after testing
        /// </summary>
        private void CheckForSweep_OLD(Bars bars, double atrValue)
        {
            var refs = _refManager.ComputeAllReferences(_htfPrimary, _htfSecondary);
            if (refs == null || refs.Count == 0) return;

            int idx = bars.Count - 1;
            double high = bars.HighPrices[idx];
            double low = bars.LowPrices[idx];
            double close = bars.ClosePrices[idx];
            DateTime time = bars.OpenTimes[idx];

            foreach (var r in refs)
            {
                // Check SweepUp (Bearish candidate)
                if (high > r.Level + (_breakFactor * atrValue))
                {
                    var sweepResult = ValidateSweepUp(bars, idx, r.Level, atrValue);
                    if (sweepResult != null)
                    {
                        _candidateBias = BiasDirection.Bearish;
                        // OLD: _state = BiasState.CANDIDATE;
                        _candidateTime = time;
                        _lastSweep = sweepResult;

                        _gate.EmitEvent(new OrchestratorEvent
                        {
                            EventType = "liquidity_sweep_detected",
                            Data = new Dictionary<string, object>
                            {
                                { "dir", "up" },
                                { "ref", r.Label },
                                { "htf", r.SourceHtf?.ToString() ?? "null" },
                                { "price", high },
                                { "time", time }
                            }
                        });

                        _gate.EmitEvent(new OrchestratorEvent
                        {
                            EventType = "bias_candidate_set",
                            Data = new Dictionary<string, object>
                            {
                                { "candidate", "SELL" },
                                { "reason", "sweep_up" },
                                { "ref", r.Label },
                                { "htf", r.SourceHtf?.ToString() ?? "null" },
                                { "time", time }
                            }
                        });

                        if (_config.EnableDebugLogging)
                            _bot.Print($"[BiasStateMachine] IDLE → CANDIDATE (SELL) | Sweep: {r.Label} @ {r.Level:F5}");

                        return; // Only one sweep per bar
                    }
                }

                // Check SweepDown (Bullish candidate)
                if (low < r.Level - (_breakFactor * atrValue))
                {
                    var sweepResult = ValidateSweepDown(bars, idx, r.Level, atrValue);
                    if (sweepResult != null)
                    {
                        _candidateBias = BiasDirection.Bullish;
                        // OLD: _state = BiasState.CANDIDATE;
                        _candidateTime = time;
                        _lastSweep = sweepResult;

                        _gate.EmitEvent(new OrchestratorEvent
                        {
                            EventType = "liquidity_sweep_detected",
                            Data = new Dictionary<string, object>
                            {
                                { "dir", "down" },
                                { "ref", r.Label },
                                { "htf", r.SourceHtf?.ToString() ?? "null" },
                                { "price", low },
                                { "time", time }
                            }
                        });

                        _gate.EmitEvent(new OrchestratorEvent
                        {
                            EventType = "bias_candidate_set",
                            Data = new Dictionary<string, object>
                            {
                                { "candidate", "BUY" },
                                { "reason", "sweep_down" },
                                { "ref", r.Label },
                                { "htf", r.SourceHtf?.ToString() ?? "null" },
                                { "time", time }
                            }
                        });

                        if (_config.EnableDebugLogging)
                            _bot.Print($"[BiasStateMachine] IDLE → CANDIDATE (BUY) | Sweep: {r.Label} @ {r.Level:F5}");

                        return;
                    }
                }
            }
        }

        /// <summary>
        /// Validate SweepUp: Break above + close back inside + displacement down
        /// </summary>
        private SweepEvent ValidateSweepUp(Bars bars, int sweepIdx, double refLevel, double atrValue)
        {
            double sweepHigh = bars.HighPrices[sweepIdx];
            double dispThreshold = _dispMult * atrValue;

            // Check next N bars for close back inside + displacement
            for (int i = sweepIdx; i < Math.Min(sweepIdx + _confirmBars, bars.Count); i++)
            {
                double close = bars.ClosePrices[i];
                if (close < refLevel) // Close back inside (below ref)
                {
                    double displacement = sweepHigh - close;
                    if (displacement >= dispThreshold)
                    {
                        return new SweepEvent
                        {
                            Time = bars.OpenTimes[sweepIdx],
                            Direction = "up",
                            RefLabel = "ref",
                            RefLevel = refLevel,
                            SweepPrice = sweepHigh,
                            ClosePrice = close,
                            Displacement = displacement
                        };
                    }
                }
            }
            return null;
        }

        /// <summary>
        /// Validate SweepDown: Break below + close back inside + displacement up
        /// </summary>
        private SweepEvent ValidateSweepDown(Bars bars, int sweepIdx, double refLevel, double atrValue)
        {
            double sweepLow = bars.LowPrices[sweepIdx];
            double dispThreshold = _dispMult * atrValue;

            for (int i = sweepIdx; i < Math.Min(sweepIdx + _confirmBars, bars.Count); i++)
            {
                double close = bars.ClosePrices[i];
                if (close > refLevel) // Close back inside (above ref)
                {
                    double displacement = close - sweepLow;
                    if (displacement >= dispThreshold)
                    {
                        return new SweepEvent
                        {
                            Time = bars.OpenTimes[sweepIdx],
                            Direction = "down",
                            RefLabel = "ref",
                            RefLevel = refLevel,
                            SweepPrice = sweepLow,
                            ClosePrice = close,
                            Displacement = displacement
                        };
                    }
                }
            }
            return null;
        }

        /// <summary>
        /// OLD METHOD - No longer used in new ICT sequence flow
        /// </summary>
        private void CheckForConfirmation_OLD(Bars bars, double atrValue)
        {
            if (_candidateBias == null) return;

            int idx = bars.Count - 1;
            double close = bars.ClosePrices[idx];
            DateTime time = bars.OpenTimes[idx];

            // Get Daily Open (DO)
            var dailyBars = _htfData.GetHtfBars(TimeFrame.Daily);
            if (dailyBars == null || dailyBars.Count < 1) return;
            double dailyOpen = dailyBars.OpenPrices[dailyBars.Count - 1]; // Current day open

            // Get Asia High/Low
            var refs = _refManager.ComputeAllReferences(_htfPrimary, _htfSecondary);
            var asiaH = refs.FirstOrDefault(r => r.Label == "Asia_H");
            var asiaL = refs.FirstOrDefault(r => r.Label == "Asia_L");

            string confirmMetric = "";
            bool confirmed = false;

            if (_candidateBias == BiasDirection.Bullish)
            {
                // BUY confirmation: close > DO OR close > Asia_H OR range expansion
                if (close > dailyOpen)
                {
                    confirmed = true;
                    confirmMetric = "close>DO";
                }
                else if (asiaH != null && close > asiaH.Level)
                {
                    confirmed = true;
                    confirmMetric = "close>Asia_H";
                }
                // TODO: Add range expansion check
            }
            else if (_candidateBias == BiasDirection.Bearish)
            {
                // SELL confirmation: close < DO OR close < Asia_L
                if (close < dailyOpen)
                {
                    confirmed = true;
                    confirmMetric = "close<DO";
                }
                else if (asiaL != null && close < asiaL.Level)
                {
                    confirmed = true;
                    confirmMetric = "close<Asia_L";
                }
            }

            if (confirmed)
            {
                _confirmedBias = _candidateBias;
                // OLD: _state = BiasState.CONFIRMED_BIAS;

                // Grade confidence (HTF body alignment)
                _confidence = GradeConfidence(_confirmedBias.Value);

                _gate.EmitEvent(new OrchestratorEvent
                {
                    EventType = "bias_confirmed",
                    Data = new Dictionary<string, object>
                    {
                        { "bias", _confirmedBias == BiasDirection.Bullish ? "BUY" : "SELL" },
                        { "confidence", _confidence.ToString().ToLower() },
                        { "confirm_metric", confirmMetric },
                        { "active_htfs", new[] { _htfPrimary.ToString(), _htfSecondary.ToString() } },
                        { "time", time }
                    }
                });

                if (_config.EnableDebugLogging)
                    _bot.Print($"[BiasStateMachine] CANDIDATE → CONFIRMED_BIAS ({_confirmedBias}) | Metric: {confirmMetric}, Confidence: {_confidence}");
            }
        }

        /// <summary>
        /// Grade confidence based on HTF body alignment
        /// </summary>
        private ConfidenceLevel GradeConfidence(BiasDirection bias)
        {
            int score = 1; // Base

            // Check HTF primary body alignment
            var htfPri = _htfData.GetLastCompletedCandle(_htfPrimary);
            if (htfPri != null)
            {
                bool htfBullish = htfPri.Close > htfPri.Open;
                bool htfBearish = htfPri.Close < htfPri.Open;

                if (bias == BiasDirection.Bullish && htfBullish) score++;
                if (bias == BiasDirection.Bearish && htfBearish) score++;
            }

            // Check HTF secondary body alignment
            var htfSec = _htfData.GetLastCompletedCandle(_htfSecondary);
            if (htfSec != null)
            {
                bool htfBullish = htfSec.Close > htfSec.Open;
                bool htfBearish = htfSec.Close < htfSec.Open;

                if (bias == BiasDirection.Bullish && htfBullish) score++;
                if (bias == BiasDirection.Bearish && htfBearish) score++;
            }

            if (score >= 3) return ConfidenceLevel.High;
            if (score == 2) return ConfidenceLevel.Base;
            return ConfidenceLevel.Low;
        }

        /// <summary>
        /// CRITICAL (Oct 25): Check for liquidity sweep opposite to bias direction
        /// Per ICT: Bullish bias → wait for sweep of lows, Bearish bias → wait for sweep of highs
        /// </summary>
        private void CheckForLiquiditySweep(Bars bars, double atrValue)
        {
            if (_confirmedBias == null) return;

            var refs = _refManager.ComputeAllReferences(_htfPrimary, _htfSecondary);
            if (refs == null || refs.Count == 0) return;

            int idx = bars.Count - 1;
            double high = bars.HighPrices[idx];
            double low = bars.LowPrices[idx];
            double close = bars.ClosePrices[idx];
            DateTime time = bars.OpenTimes[idx];

            // For BULLISH bias: Look for sweep DOWN (manipulation low)
            if (_confirmedBias == BiasDirection.Bullish)
            {
                // Check for sweep below demand zones (PDL, Asia_L, etc.)
                foreach (var r in refs)
                {
                    if (r.Type == "Demand" && low < r.Level - (_breakFactor * atrValue))
                    {
                        var sweepResult = ValidateSweepDown(bars, idx, r.Level, atrValue);
                        if (sweepResult != null)
                        {
                            _lastSweep = sweepResult;
                            _state = BiasState.SWEEP_DETECTED;

                            if (_config.EnableDebugLogging)
                                _bot.Print($"[ICT Sequence] BULLISH bias: Sweep DOWN detected at {r.Label} | Waiting for bullish MSS");

                            _gate.EmitEvent(new OrchestratorEvent
                            {
                                EventType = "liquidity_sweep_for_bias",
                                Data = new Dictionary<string, object>
                                {
                                    { "bias", "BULLISH" },
                                    { "sweep_dir", "DOWN" },
                                    { "ref", r.Label },
                                    { "price", low },
                                    { "time", time }
                                }
                            });
                            return;
                        }
                    }
                }
            }
            // For BEARISH bias: Look for sweep UP (manipulation high)
            else if (_confirmedBias == BiasDirection.Bearish)
            {
                // Check for sweep above supply zones (PDH, Asia_H, etc.)
                foreach (var r in refs)
                {
                    if (r.Type == "Supply" && high > r.Level + (_breakFactor * atrValue))
                    {
                        var sweepResult = ValidateSweepUp(bars, idx, r.Level, atrValue);
                        if (sweepResult != null)
                        {
                            _lastSweep = sweepResult;
                            _state = BiasState.SWEEP_DETECTED;

                            if (_config.EnableDebugLogging)
                                _bot.Print($"[ICT Sequence] BEARISH bias: Sweep UP detected at {r.Label} | Waiting for bearish MSS");

                            _gate.EmitEvent(new OrchestratorEvent
                            {
                                EventType = "liquidity_sweep_for_bias",
                                Data = new Dictionary<string, object>
                                {
                                    { "bias", "BEARISH" },
                                    { "sweep_dir", "UP" },
                                    { "ref", r.Label },
                                    { "price", high },
                                    { "time", time }
                                }
                            });
                            return;
                        }
                    }
                }
            }
        }

        /// <summary>
        /// CRITICAL (Oct 25): Check for MSS with displacement and FVG
        /// Per ICT: Valid MSS must have strong displacement leaving FVG
        /// </summary>
        private void CheckForMSSWithDisplacement(Bars bars, double atrValue)
        {
            if (_confirmedBias == null || _lastSweep == null) return;
            if (bars.Count < 5) return;

            int idx = bars.Count - 1;
            double close = bars.ClosePrices[idx];
            double open = bars.OpenPrices[idx];
            double high = bars.HighPrices[idx];
            double low = bars.LowPrices[idx];
            DateTime time = bars.OpenTimes[idx];

            // Displacement threshold (strong move)
            double displacementThresh = _dispMult * atrValue;

            // For BULLISH bias after sweep down: Look for bullish MSS
            if (_confirmedBias == BiasDirection.Bullish)
            {
                // Check for bullish displacement (strong green candle)
                double bullishDisplacement = close - open;

                // Look for break of recent swing high with body
                for (int i = idx - 1; i >= Math.Max(0, idx - 10); i--)
                {
                    double swingHigh = bars.HighPrices[i];

                    // MSS: Close above swing high with displacement
                    if (close > swingHigh && bullishDisplacement >= displacementThresh)
                    {
                        // Check for FVG (gap between current low and previous high)
                        if (idx > 1)
                        {
                            double prevHigh = bars.HighPrices[idx - 1];
                            double fvgSize = low - prevHigh;

                            if (fvgSize > 0) // Valid FVG exists
                            {
                                _state = BiasState.MSS_CONFIRMED;

                                if (_config.EnableDebugLogging)
                                    _bot.Print($"[ICT Sequence] BULLISH MSS confirmed with displacement {bullishDisplacement:F5} and FVG {fvgSize:F5}");

                                _gate.EmitEvent(new OrchestratorEvent
                                {
                                    EventType = "mss_with_displacement",
                                    Data = new Dictionary<string, object>
                                    {
                                        { "bias", "BULLISH" },
                                        { "displacement", bullishDisplacement },
                                        { "fvg_size", fvgSize },
                                        { "break_level", swingHigh },
                                        { "time", time }
                                    }
                                });
                                return;
                            }
                        }
                    }
                }
            }
            // For BEARISH bias after sweep up: Look for bearish MSS
            else if (_confirmedBias == BiasDirection.Bearish)
            {
                // Check for bearish displacement (strong red candle)
                double bearishDisplacement = open - close;

                // Look for break of recent swing low with body
                for (int i = idx - 1; i >= Math.Max(0, idx - 10); i--)
                {
                    double swingLow = bars.LowPrices[i];

                    // MSS: Close below swing low with displacement
                    if (close < swingLow && bearishDisplacement >= displacementThresh)
                    {
                        // Check for FVG (gap between current high and previous low)
                        if (idx > 1)
                        {
                            double prevLow = bars.LowPrices[idx - 1];
                            double fvgSize = prevLow - high;

                            if (fvgSize > 0) // Valid FVG exists
                            {
                                _state = BiasState.MSS_CONFIRMED;

                                if (_config.EnableDebugLogging)
                                    _bot.Print($"[ICT Sequence] BEARISH MSS confirmed with displacement {bearishDisplacement:F5} and FVG {fvgSize:F5}");

                                _gate.EmitEvent(new OrchestratorEvent
                                {
                                    EventType = "mss_with_displacement",
                                    Data = new Dictionary<string, object>
                                    {
                                        { "bias", "BEARISH" },
                                        { "displacement", bearishDisplacement },
                                        { "fvg_size", fvgSize },
                                        { "break_level", swingLow },
                                        { "time", time }
                                    }
                                });
                                return;
                            }
                        }
                    }
                }
            }
        }

        /// <summary>
        /// OLD METHOD - No longer used in new ICT sequence flow
        /// </summary>
        private void TransitionToReadyForMss_OLD()
        {
            // OLD: _state = BiasState.READY_FOR_MSS;

            _gate.OpenGate("MSS", "bias_confirmed");

            if (_config.EnableDebugLogging)
                _bot.Print($"[BiasStateMachine] OLD: CONFIRMED_BIAS → READY_FOR_MSS | Gate OPEN for MSS");
        }

        /// <summary>
        /// OLD METHOD - Check if candidate timed out
        /// </summary>
        private void CheckCandidateTimeout_OLD()
        {
            // OLD: if (_state != BiasState.CANDIDATE) return;

            TimeSpan elapsed = _bot.Server.Time - _candidateTime;
            if (elapsed.TotalMinutes > _confirmWindowMin)
            {
                _gate.EmitEvent(new OrchestratorEvent
                {
                    EventType = "bias_invalidated",
                    Data = new Dictionary<string, object>
                    {
                        { "from", _candidateBias == BiasDirection.Bullish ? "BUY" : "SELL" },
                        { "to", "IDLE" },
                        { "reason", "timeout" },
                        { "time", _bot.Server.Time }
                    }
                });

                if (_config.EnableDebugLogging)
                    _bot.Print($"[BiasStateMachine] CANDIDATE → INVALIDATED (timeout: {elapsed.TotalMinutes:F0} min)");

                Reset();
            }
        }

        /// <summary>
        /// Check for opposite sweep + flip threshold (invalidation)
        /// </summary>
        private void CheckInvalidation(Bars bars, double atrValue)
        {
            if (_state == BiasState.IDLE || _state == BiasState.INVALIDATED) return;
            if (_candidateBias == null) return;

            var refs = _refManager.ComputeAllReferences(_htfPrimary, _htfSecondary);
            if (refs == null || refs.Count == 0) return;

            int idx = bars.Count - 1;
            double high = bars.HighPrices[idx];
            double low = bars.LowPrices[idx];
            double close = bars.ClosePrices[idx];
            double flipThreshold = _flipThresh * atrValue;

            if (_candidateBias == BiasDirection.Bullish)
            {
                // Check for bearish invalidation (sweep down + move below)
                foreach (var r in refs)
                {
                    if (r.Type == "Demand" && low < r.Level - flipThreshold)
                    {
                        if (close < r.Level - flipThreshold)
                        {
                            _gate.EmitEvent(new OrchestratorEvent
                            {
                                EventType = "bias_invalidated",
                                Data = new Dictionary<string, object>
                                {
                                    { "from", _confirmedBias != null ? "BUY" : "CANDIDATE_BUY" },
                                    { "to", "IDLE" },
                                    { "reason", "opposite_sweep" },
                                    { "time", _bot.Server.Time }
                                }
                            });

                            _gate.CloseGate("MSS", "bias_invalidated");

                            if (_config.EnableDebugLogging)
                                _bot.Print($"[BiasStateMachine] {_state} → INVALIDATED (opposite sweep at {r.Label})");

                            Reset();
                            return;
                        }
                    }
                }
            }
            else if (_candidateBias == BiasDirection.Bearish)
            {
                // Check for bullish invalidation (sweep up + move above)
                foreach (var r in refs)
                {
                    if (r.Type == "Supply" && high > r.Level + flipThreshold)
                    {
                        if (close > r.Level + flipThreshold)
                        {
                            _gate.EmitEvent(new OrchestratorEvent
                            {
                                EventType = "bias_invalidated",
                                Data = new Dictionary<string, object>
                                {
                                    { "from", _confirmedBias != null ? "SELL" : "CANDIDATE_SELL" },
                                    { "to", "IDLE" },
                                    { "reason", "opposite_sweep" },
                                    { "time", _bot.Server.Time }
                                }
                            });

                            _gate.CloseGate("MSS", "bias_invalidated");

                            if (_config.EnableDebugLogging)
                                _bot.Print($"[BiasStateMachine] {_state} → INVALIDATED (opposite sweep at {r.Label})");

                            Reset();
                            return;
                        }
                    }
                }
            }
        }
    }
}
