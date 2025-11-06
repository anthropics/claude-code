using System;
using cAlgo.API;

namespace CCTTB
{
    /// <summary>
    /// Manages Phase 1 (counter-trend toward OTE) and Phase 3 (with-trend from OTE) entry logic.
    /// Tracks phase state, risk allocation, and conditional entry permissions.
    /// </summary>
    public enum TradingPhase
    {
        NoBias = 0,         // No daily bias established
        Phase1_Pending = 1, // Bias set, waiting for Phase 1 conditions
        Phase1_Active = 2,  // Phase 1 trade active
        Phase1_Success = 3, // Phase 1 hit TP
        Phase1_Failed = 4,  // Phase 1 hit SL
        Phase3_Pending = 5, // Waiting for OTE touch for Phase 3
        Phase3_Active = 6,  // Phase 3 trade active
        Phase3_Complete = 7,// Phase 3 exited (TP or SL)
        CycleComplete = 8   // Full cycle done, waiting for new bias
    }

    public class PhaseManager
    {
        private readonly Robot _bot;
        private readonly PhasedPolicySimple _policy;
        private readonly TradeJournal _journal;
        private readonly OTETouchDetector _oteDetector;
        private readonly CascadeValidator _cascadeValidator;

        // Current phase state
        private TradingPhase _currentPhase = TradingPhase.NoBias;
        private BiasDirection _currentBias = BiasDirection.Neutral;

        // Phase 1 tracking
        private int _phase1Attempts = 0;
        private int _phase1ConsecutiveFailures = 0;
        private DateTime _lastPhase1Entry = DateTime.MinValue;
        private DateTime _lastPhase1Exit = DateTime.MinValue;
        private bool _phase1HitTP = false;

        // Phase 3 tracking
        private int _phase3Attempts = 0;
        private DateTime _lastPhase3Entry = DateTime.MinValue;
        private DateTime _lastPhase3Exit = DateTime.MinValue;

        // Daily cycle tracking
        private DateTime _biasSetTime = DateTime.MinValue;
        private DateTime _lastResetTime = DateTime.MinValue;
        private int _totalEntriesThisBias = 0;

        public PhaseManager(
            Robot bot,
            PhasedPolicySimple policy,
            TradeJournal journal,
            OTETouchDetector oteDetector,
            CascadeValidator cascadeValidator)
        {
            _bot = bot;
            _policy = policy;
            _journal = journal;
            _oteDetector = oteDetector;
            _cascadeValidator = cascadeValidator;

            _bot.Print("[PhaseManager] Initialized");
        }

        // ===== Phase State Management =====

        /// <summary>
        /// Get current trading phase.
        /// </summary>
        public TradingPhase GetCurrentPhase()
        {
            return _currentPhase;
        }

        /// <summary>
        /// Get current bias direction.
        /// </summary>
        public BiasDirection GetCurrentBias()
        {
            return _currentBias;
        }

        /// <summary>
        /// Set daily bias and transition to Phase 1 Pending.
        /// </summary>
        public void SetBias(BiasDirection bias, string source = "Unknown")
        {
            if (bias == BiasDirection.Neutral)
            {
                _journal?.Debug("[PhaseManager] Cannot set Neutral bias - use ResetCycle() instead");
                return;
            }

            _currentBias = bias;
            _currentPhase = TradingPhase.Phase1_Pending;
            _biasSetTime = DateTime.Now;

            // Reset counters
            _phase1Attempts = 0;
            _phase1ConsecutiveFailures = 0;
            _phase3Attempts = 0;
            _totalEntriesThisBias = 0;
            _phase1HitTP = false;

            _journal?.Debug($"[PhaseManager] 🎯 Bias set: {bias} (Source: {source}) → Phase 1 Pending");
        }

        /// <summary>
        /// Invalidate current bias and reset cycle.
        /// </summary>
        public void InvalidateBias(string reason = "Manual invalidation")
        {
            _journal?.Debug($"[PhaseManager] ❌ Bias invalidated: {reason}");
            ResetCycle();
        }

        /// <summary>
        /// Reset entire cycle (back to NoBias).
        /// </summary>
        public void ResetCycle()
        {
            _currentPhase = TradingPhase.NoBias;
            _currentBias = BiasDirection.Neutral;
            _lastResetTime = DateTime.Now;

            _journal?.Debug("[PhaseManager] Cycle reset → NoBias");
        }

        // ===== Phase 1 Logic =====

        /// <summary>
        /// Check if Phase 1 entry is allowed.
        /// </summary>
        public bool CanEnterPhase1()
        {
            // Must be in Phase1_Pending state
            if (_currentPhase != TradingPhase.Phase1_Pending)
                return false;

            // Must have valid bias
            if (_currentBias == BiasDirection.Neutral)
                return false;

            // Check max attempts
            int maxAttempts = _policy.Phase1MaxAttempts();
            if (_phase1Attempts >= maxAttempts)
            {
                if (_policy.EnableDebugLogging())
                {
                    _journal?.Debug($"[PhaseManager] Phase 1 BLOCKED: Max attempts reached ({_phase1Attempts}/{maxAttempts})");
                }
                return false;
            }

            // Check OTE not already touched
            if (_oteDetector.HasValidOTE() && _oteDetector.GetTouchLevel() >= OTETouchLevel.Optimal)
            {
                if (_policy.EnableDebugLogging())
                {
                    _journal?.Debug("[PhaseManager] Phase 1 BLOCKED: OTE already touched");
                }
                return false;
            }

            // Check execution cascade is valid
            if (!_cascadeValidator.IsExecutionCascadeValid())
            {
                if (_policy.EnableDebugLogging())
                {
                    _journal?.Debug("[PhaseManager] Phase 1 BLOCKED: Execution cascade not confirmed");
                }
                return false;
            }

            return true;
        }

        /// <summary>
        /// Register Phase 1 entry.
        /// </summary>
        public void OnPhase1Entry()
        {
            _currentPhase = TradingPhase.Phase1_Active;
            _phase1Attempts++;
            _totalEntriesThisBias++;
            _lastPhase1Entry = DateTime.Now;

            _journal?.Debug($"[PhaseManager] 📈 Phase 1 entry #{_phase1Attempts} (Bias: {_currentBias})");
        }

        /// <summary>
        /// Register Phase 1 exit.
        /// </summary>
        public void OnPhase1Exit(bool hitTP, double pnl)
        {
            _lastPhase1Exit = DateTime.Now;

            if (hitTP)
            {
                _currentPhase = TradingPhase.Phase3_Pending;
                _phase1HitTP = true;
                _phase1ConsecutiveFailures = 0;  // Reset failure counter
                _journal?.Debug($"[PhaseManager] ✅ Phase 1 TP HIT (+{pnl:F2}) → Phase 3 Pending");
            }
            else
            {
                _currentPhase = TradingPhase.Phase1_Failed;
                _phase1ConsecutiveFailures++;
                _journal?.Debug($"[PhaseManager] ❌ Phase 1 SL HIT ({pnl:F2}) → Failure #{_phase1ConsecutiveFailures}");

                // Check if should block Phase 3
                if (_phase1ConsecutiveFailures >= 2)
                {
                    _journal?.Debug($"[PhaseManager] 🚫 2× Phase 1 failures → Phase 3 BLOCKED for this bias");
                    _currentPhase = TradingPhase.CycleComplete;
                }
                else
                {
                    // Allow Phase 3 with reduced risk (if OTE touches)
                    _currentPhase = TradingPhase.Phase3_Pending;
                    _journal?.Debug($"[PhaseManager] ⚠️ Phase 3 still allowed (1× failure) with reduced risk");
                }
            }
        }

        // ===== Phase 3 Logic =====

        /// <summary>
        /// Check if Phase 3 entry is allowed.
        /// MODIFIED OCT 26: Allow direct Phase 3 from Phase1_Pending (no OB/FVG available = "noPhase1" scenario)
        /// </summary>
        public bool CanEnterPhase3(out double riskMultiplier, out bool requireExtraConfirmation)
        {
            riskMultiplier = 1.0;
            requireExtraConfirmation = false;

            // Allow Phase3_Pending OR Phase1_Pending (direct Phase 3 when no Phase 1 setup available)
            if (_currentPhase != TradingPhase.Phase3_Pending && _currentPhase != TradingPhase.Phase1_Pending)
            {
                if (_policy.EnableDebugLogging())
                {
                    _journal?.Debug($"[PhaseManager] Phase 3 BLOCKED: Wrong phase ({_currentPhase})");
                }
                return false;
            }

            // Must have valid bias
            if (_currentBias == BiasDirection.Neutral)
                return false;

            // Check if blocked by 2× Phase 1 failures
            if (_phase1ConsecutiveFailures >= 2)
            {
                _journal?.Debug("[PhaseManager] Phase 3 BLOCKED: 2× Phase 1 failures");
                return false;
            }

            // Check OTE touched
            if (!_oteDetector.HasValidOTE())
            {
                if (_policy.EnableDebugLogging())
                {
                    _journal?.Debug("[PhaseManager] Phase 3 BLOCKED: No valid OTE zone");
                }
                return false;
            }

            // OTE TOUCH GATE DISABLED (Oct 26, 2025 - Fix #9)
            // REASON: OTETouchDetector not synchronized with BuildTradeSignal OTE tap detection
            // BuildTradeSignal already validates OTE is tapped (line "OTE: tapped dir=X"), but
            // PhaseManager's _oteDetector.GetTouchLevel() returns None even when OTE IS tapped
            // RESULT: All valid entries blocked despite passing OTE validation
            // SOLUTION: Trust BuildTradeSignal's OTE tap validation, skip redundant PhaseManager check
            //
            // Original code (DISABLED):
            // var oteLevel = _oteDetector.GetTouchLevel();
            // if (oteLevel < OTETouchLevel.Optimal)
            // {
            //     if (_policy.EnableDebugLogging())
            //     {
            //         _journal?.Debug($"[PhaseManager] Phase 3 BLOCKED: OTE not touched (Level: {oteLevel})");
            //     }
            //     return false;
            // }
            //
            // // Check if OTE exceeded (>79% = too deep)
            // if (oteLevel == OTETouchLevel.Exceeded)
            // {
            //     _journal?.Debug("[PhaseManager] Phase 3 BLOCKED: OTE exceeded (>79%), structure weakening");
            //     return false;
            // }
            //
            // FIX: Skip OTE touch validation - BuildTradeSignal already handles this correctly

            // TEMPORARILY DISABLED OCT 26: Cascade validation too strict, blocking all entries
            // The cascade requires HTF Sweep → Mid Sweep → LTF MSS, but Mid sweep rarely triggers
            // OTE touch + bias validation is sufficient for entry confirmation
            //
            // TODO: Revisit cascade logic or make it optional via policy
            /*
            if (!_cascadeValidator.IsExecutionCascadeValid())
            {
                if (_policy.EnableDebugLogging())
                {
                    _journal?.Debug("[PhaseManager] Phase 3 BLOCKED: Execution cascade not confirmed");
                }
                return false;
            }
            */

            // Determine risk multiplier and confirmation requirements based on Phase 1 outcome
            if (_phase1Attempts == 0)
            {
                // No Phase 1 attempted - standard risk
                riskMultiplier = _policy.GetPhase3RiskMultiplier("noPhase1");
                requireExtraConfirmation = false;
                _journal?.Debug($"[PhaseManager] Phase 3 allowed: No Phase 1 attempted (Risk: {riskMultiplier:F2}×)");
            }
            else if (_phase1HitTP)
            {
                // Phase 1 success - high confidence, increase risk
                riskMultiplier = _policy.GetPhase3RiskMultiplier("afterPhase1Success");
                requireExtraConfirmation = false;
                _journal?.Debug($"[PhaseManager] Phase 3 allowed: Phase 1 TP hit (Risk: {riskMultiplier:F2}×, HIGH CONFIDENCE)");
            }
            else if (_phase1ConsecutiveFailures == 1)
            {
                // 1× Phase 1 failure - reduced risk + extra confirmation
                riskMultiplier = _policy.GetPhase3RiskMultiplier("afterPhase1Failure1x");
                requireExtraConfirmation = true;
                _journal?.Debug($"[PhaseManager] Phase 3 allowed: 1× Phase 1 failure (Risk: {riskMultiplier:F2}×, EXTRA CONFIRMATION REQUIRED)");
            }
            else
            {
                // Should not reach here (2× failures blocked above)
                return false;
            }

            return true;
        }

        /// <summary>
        /// Register Phase 3 entry.
        /// </summary>
        public void OnPhase3Entry()
        {
            _currentPhase = TradingPhase.Phase3_Active;
            _phase3Attempts++;
            _totalEntriesThisBias++;
            _lastPhase3Entry = DateTime.Now;

            _journal?.Debug($"[PhaseManager] 📊 Phase 3 entry #{_phase3Attempts} (Bias: {_currentBias}, OTE: {_oteDetector.GetTouchLevel()})");
        }

        /// <summary>
        /// Register Phase 3 exit.
        /// </summary>
        public void OnPhase3Exit(bool hitTP, double pnl)
        {
            _lastPhase3Exit = DateTime.Now;
            _currentPhase = TradingPhase.Phase3_Complete;

            if (hitTP)
            {
                _journal?.Debug($"[PhaseManager] ✅ Phase 3 TP HIT (+{pnl:F2}) → Cycle Complete");
            }
            else
            {
                _journal?.Debug($"[PhaseManager] ❌ Phase 3 SL HIT ({pnl:F2}) → Cycle Complete");
            }

            // Transition to CycleComplete
            _currentPhase = TradingPhase.CycleComplete;
        }

        // ===== Risk Calculation =====

        /// <summary>
        /// Calculate risk percent for current phase.
        /// </summary>
        public double GetRiskPercent(TradingPhase phase, double riskMultiplier = 1.0)
        {
            if (phase == TradingPhase.Phase1_Active || phase == TradingPhase.Phase1_Pending)
            {
                return _policy.Phase1RiskPercent() * riskMultiplier;
            }
            else if (phase == TradingPhase.Phase3_Active || phase == TradingPhase.Phase3_Pending)
            {
                return _policy.Phase3RiskPercent() * riskMultiplier;
            }

            // Default to base risk
            return _policy.BaseRiskPercent();
        }

        /// <summary>
        /// Get reward-risk target for current phase.
        /// </summary>
        public double GetRewardRiskTarget(TradingPhase phase)
        {
            if (phase == TradingPhase.Phase1_Active || phase == TradingPhase.Phase1_Pending)
            {
                return _policy.Phase1RewardRiskTarget();
            }
            else if (phase == TradingPhase.Phase3_Active || phase == TradingPhase.Phase3_Pending)
            {
                return _policy.Phase3RewardRiskTarget();
            }

            return 2.0;  // Default
        }

        // ===== Status & Debugging =====

        /// <summary>
        /// Get phase summary for logging.
        /// </summary>
        public string GetPhaseSummary()
        {
            return $"Phase: {_currentPhase}, Bias: {_currentBias}, P1: {_phase1Attempts}×, P3: {_phase3Attempts}×, Total: {_totalEntriesThisBias}×";
        }

        /// <summary>
        /// Print detailed phase status.
        /// </summary>
        public void PrintStatus()
        {
            _bot.Print($"╔════════════════════════════════════════╗");
            _bot.Print($"║   PHASE MANAGER STATUS");
            _bot.Print($"╚════════════════════════════════════════╝");
            _bot.Print($"Current Phase: {_currentPhase}");
            _bot.Print($"Current Bias: {_currentBias}");
            _bot.Print($"Bias Set: {(_biasSetTime == DateTime.MinValue ? "Never" : _biasSetTime.ToString("HH:mm:ss"))}");
            _bot.Print($"");
            _bot.Print($"─── Phase 1 (Counter-Trend) ───");
            _bot.Print($"Attempts: {_phase1Attempts}");
            _bot.Print($"Consecutive Failures: {_phase1ConsecutiveFailures}");
            _bot.Print($"Hit TP: {(_phase1HitTP ? "✅" : "❌")}");
            _bot.Print($"Last Entry: {(_lastPhase1Entry == DateTime.MinValue ? "Never" : _lastPhase1Entry.ToString("HH:mm:ss"))}");
            _bot.Print($"Last Exit: {(_lastPhase1Exit == DateTime.MinValue ? "Never" : _lastPhase1Exit.ToString("HH:mm:ss"))}");
            _bot.Print($"Can Enter: {(CanEnterPhase1() ? "✅" : "❌")}");
            _bot.Print($"");
            _bot.Print($"─── Phase 3 (With-Trend from OTE) ───");
            _bot.Print($"Attempts: {_phase3Attempts}");
            _bot.Print($"Last Entry: {(_lastPhase3Entry == DateTime.MinValue ? "Never" : _lastPhase3Entry.ToString("HH:mm:ss"))}");
            _bot.Print($"Last Exit: {(_lastPhase3Exit == DateTime.MinValue ? "Never" : _lastPhase3Exit.ToString("HH:mm:ss"))}");

            double riskMult;
            bool extraConf;
            bool canEnter = CanEnterPhase3(out riskMult, out extraConf);
            _bot.Print($"Can Enter: {(canEnter ? "✅" : "❌")}");
            if (canEnter)
            {
                _bot.Print($"  Risk Multiplier: {riskMult:F2}×");
                _bot.Print($"  Extra Confirmation: {(extraConf ? "✅ Required" : "❌ Not Required")}");
            }
            _bot.Print($"");
            _bot.Print($"─── Cycle ───");
            _bot.Print($"Total Entries This Bias: {_totalEntriesThisBias}");
            _bot.Print($"Last Reset: {(_lastResetTime == DateTime.MinValue ? "Never" : _lastResetTime.ToString("HH:mm:ss"))}");
            _bot.Print($"╚════════════════════════════════════════╝");
        }

        /// <summary>
        /// Get phase 1 consecutive failures count (for external checks).
        /// </summary>
        public int GetPhase1ConsecutiveFailures()
        {
            return _phase1ConsecutiveFailures;
        }

        /// <summary>
        /// Get total entries this bias (for daily limit checks).
        /// </summary>
        public int GetTotalEntriesThisBias()
        {
            return _totalEntriesThisBias;
        }
    }
}
