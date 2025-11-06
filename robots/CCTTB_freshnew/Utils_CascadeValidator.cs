using System;
using System.Collections.Generic;
using System.Linq;
using cAlgo.API;

namespace CCTTB
{
    /// <summary>
    /// Validates multi-timeframe cascades for sweep-MSS confirmation.
    /// Supports: Daily→1H→15M (bias) and 4H→15M→5M (execution).
    /// Ensures HTF sweep is followed by LTF MSS within timeout window.
    /// </summary>
    public class CascadeValidator
    {
        private readonly Robot _bot;
        private readonly PhasedPolicySimple _policy;
        private readonly TradeJournal _journal;

        // Cascade tracking
        private Dictionary<string, CascadeState> _activeCascades;

        public CascadeValidator(
            Robot bot,
            PhasedPolicySimple policy,
            TradeJournal journal)
        {
            _bot = bot;
            _policy = policy;
            _journal = journal;

            _activeCascades = new Dictionary<string, CascadeState>();

            _bot.Print("[Cascade] Validator initialized");
            LoadCascadeConfigs();
        }

        /// <summary>
        /// Cascade state tracking.
        /// </summary>
        private class CascadeState
        {
            public string Name { get; set; }
            public int TimeoutMinutes { get; set; }

            // HTF Sweep
            public bool HTF_SweepDetected { get; set; }
            public DateTime HTF_SweepTime { get; set; }
            public double HTF_SweepLevel { get; set; }
            public TradeType HTF_SweepDirection { get; set; }

            // Mid TF Sweep
            public bool Mid_SweepDetected { get; set; }
            public DateTime Mid_SweepTime { get; set; }
            public double Mid_SweepLevel { get; set; }
            public TradeType Mid_SweepDirection { get; set; }

            // LTF MSS
            public bool LTF_MSSDetected { get; set; }
            public DateTime LTF_MSSTime { get; set; }
            public TradeType LTF_MSSDirection { get; set; }

            // Validation
            public bool IsComplete { get; set; }
            public bool IsValid { get; set; }
            public DateTime ExpiresAt { get; set; }

            public CascadeState()
            {
                Reset();
            }

            public void Reset()
            {
                HTF_SweepDetected = false;
                Mid_SweepDetected = false;
                LTF_MSSDetected = false;
                IsComplete = false;
                IsValid = false;
                HTF_SweepTime = DateTime.MinValue;
                Mid_SweepTime = DateTime.MinValue;
                LTF_MSSTime = DateTime.MinValue;
                ExpiresAt = DateTime.MaxValue;
            }
        }

        /// <summary>
        /// Load cascade configurations (hardcoded).
        /// </summary>
        private void LoadCascadeConfigs()
        {
            // DailyBias: Daily → 1H → 15M (240min timeout)
            _activeCascades["DailyBias"] = new CascadeState
            {
                Name = "DailyBias",
                TimeoutMinutes = 240
            };
            _bot.Print("[Cascade] Loaded: DailyBias → Daily → 1H → 15M (Timeout: 240m)");

            // IntradayExecution: 4H → 15M → 5M (60min timeout)
            _activeCascades["IntradayExecution"] = new CascadeState
            {
                Name = "IntradayExecution",
                TimeoutMinutes = 60
            };
            _bot.Print("[Cascade] Loaded: IntradayExecution → 4H → 15M → 5M (Timeout: 60m)");
        }

        /// <summary>
        /// Register HTF sweep detection (e.g., Daily high swept).
        /// </summary>
        /// <param name="cascadeName">Cascade name (e.g., "DailyBias", "IntradayExecution")</param>
        /// <param name="sweepLevel">Price level that was swept</param>
        /// <param name="direction">Sweep direction (Buy = above, Sell = below)</param>
        public void RegisterHTFSweep(string cascadeName, double sweepLevel, TradeType direction)
        {
            if (!_activeCascades.ContainsKey(cascadeName))
            {
                _journal?.Debug($"[Cascade] Unknown cascade: {cascadeName}");
                return;
            }

            var state = _activeCascades[cascadeName];
            state.HTF_SweepDetected = true;
            state.HTF_SweepTime = DateTime.Now;
            state.HTF_SweepLevel = sweepLevel;
            state.HTF_SweepDirection = direction;
            state.ExpiresAt = DateTime.Now.AddMinutes(state.TimeoutMinutes);

            if (_policy.EnableDebugLogging())
            {
                _journal?.Debug($"[Cascade] {cascadeName}: HTF Sweep registered → {direction} @ {sweepLevel:F5} (Expires: {state.ExpiresAt:HH:mm:ss})");
            }
        }

        /// <summary>
        /// Register Mid-TF sweep detection (e.g., 1H sweep for DailyBias, 15M sweep for IntradayExecution).
        /// </summary>
        public void RegisterMidSweep(string cascadeName, double sweepLevel, TradeType direction)
        {
            if (!_activeCascades.ContainsKey(cascadeName))
                return;

            var state = _activeCascades[cascadeName];

            // Only register if HTF sweep already detected
            if (!state.HTF_SweepDetected)
            {
                if (_policy.EnableDebugLogging())
                {
                    _journal?.Debug($"[Cascade] {cascadeName}: Mid sweep ignored (no HTF sweep yet)");
                }
                return;
            }

            // Check if expired
            if (DateTime.Now > state.ExpiresAt)
            {
                _journal?.Debug($"[Cascade] {cascadeName}: Mid sweep too late (HTF sweep expired)");
                state.Reset();
                return;
            }

            // Direction should align with HTF sweep (inverse for ICT logic)
            // Example: Daily buyside sweep (bullish) → 1H should sweep sellside (bearish mini sweep)
            // This is the "liquidity grab" cascade pattern

            state.Mid_SweepDetected = true;
            state.Mid_SweepTime = DateTime.Now;
            state.Mid_SweepLevel = sweepLevel;
            state.Mid_SweepDirection = direction;

            if (_policy.EnableDebugLogging())
            {
                _journal?.Debug($"[Cascade] {cascadeName}: Mid Sweep registered → {direction} @ {sweepLevel:F5}");
            }
        }

        /// <summary>
        /// Register LTF MSS detection (e.g., 15M MSS for DailyBias, 5M MSS for IntradayExecution).
        /// </summary>
        /// <param name="cascadeName">Cascade name</param>
        /// <param name="direction">MSS direction (should match final bias direction)</param>
        /// <returns>True if cascade is now complete and valid</returns>
        public bool RegisterLTF_MSS(string cascadeName, TradeType direction)
        {
            if (!_activeCascades.ContainsKey(cascadeName))
                return false;

            var state = _activeCascades[cascadeName];

            // Check if Mid sweep detected
            if (!state.Mid_SweepDetected)
            {
                if (_policy.EnableDebugLogging())
                {
                    _journal?.Debug($"[Cascade] {cascadeName}: LTF MSS ignored (no Mid sweep yet)");
                }
                return false;
            }

            // Check if expired
            if (DateTime.Now > state.ExpiresAt)
            {
                _journal?.Debug($"[Cascade] {cascadeName}: LTF MSS too late (cascade expired)");
                state.Reset();
                return false;
            }

            // Register MSS
            state.LTF_MSSDetected = true;
            state.LTF_MSSTime = DateTime.Now;
            state.LTF_MSSDirection = direction;

            // Validate cascade completion
            state.IsComplete = ValidateCascadeCompletion(state);
            state.IsValid = state.IsComplete;

            if (state.IsValid)
            {
                double totalMinutes = (state.LTF_MSSTime - state.HTF_SweepTime).TotalMinutes;
                _journal?.Debug($"[Cascade] ✅ {cascadeName} COMPLETE: HTF sweep → Mid sweep → LTF MSS ({totalMinutes:F1}m)");
            }
            else
            {
                _journal?.Debug($"[Cascade] ❌ {cascadeName} INVALID: Direction mismatch or logic error");
                state.Reset();
            }

            return state.IsValid;
        }

        /// <summary>
        /// Validate that cascade follows correct ICT logic.
        /// </summary>
        private bool ValidateCascadeCompletion(CascadeState state)
        {
            // Must have all three components
            if (!state.HTF_SweepDetected || !state.Mid_SweepDetected || !state.LTF_MSSDetected)
                return false;

            // MSS direction should be OPPOSITE to Mid sweep (ICT reversal pattern)
            // Example: 15M sellside sweep (Sell) → 5M bullish MSS (Buy) = valid bullish setup
            bool mssOppositeToMidSweep = (state.Mid_SweepDirection == TradeType.Buy && state.LTF_MSSDirection == TradeType.Sell) ||
                                         (state.Mid_SweepDirection == TradeType.Sell && state.LTF_MSSDirection == TradeType.Buy);

            if (!mssOppositeToMidSweep)
            {
                if (_policy.EnableDebugLogging())
                {
                    _journal?.Debug($"[Cascade] {state.Name}: MSS direction ({state.LTF_MSSDirection}) not opposite to Mid sweep ({state.Mid_SweepDirection})");
                }
                return false;
            }

            // All checks passed
            return true;
        }

        /// <summary>
        /// Check if cascade is currently valid and complete.
        /// </summary>
        public bool IsCascadeValid(string cascadeName)
        {
            if (!_activeCascades.ContainsKey(cascadeName))
                return false;

            var state = _activeCascades[cascadeName];

            // Check expiration
            if (DateTime.Now > state.ExpiresAt)
            {
                if (state.IsValid)
                {
                    _journal?.Debug($"[Cascade] {cascadeName}: Expired");
                    state.Reset();
                }
                return false;
            }

            return state.IsValid && state.IsComplete;
        }

        /// <summary>
        /// Get cascade state for external inspection.
        /// </summary>
        public bool GetCascadeStatus(string cascadeName, out bool htfSweep, out bool midSweep, out bool ltfMSS, out bool complete)
        {
            htfSweep = false;
            midSweep = false;
            ltfMSS = false;
            complete = false;

            if (!_activeCascades.ContainsKey(cascadeName))
                return false;

            var state = _activeCascades[cascadeName];
            htfSweep = state.HTF_SweepDetected;
            midSweep = state.Mid_SweepDetected;
            ltfMSS = state.LTF_MSSDetected;
            complete = state.IsComplete && state.IsValid;

            return true;
        }

        /// <summary>
        /// Reset cascade (e.g., after trade entry or invalidation).
        /// </summary>
        public void ResetCascade(string cascadeName, string reason = "Manual reset")
        {
            if (!_activeCascades.ContainsKey(cascadeName))
                return;

            var state = _activeCascades[cascadeName];
            state.Reset();

            if (_policy.EnableDebugLogging())
            {
                _journal?.Debug($"[Cascade] {cascadeName}: Reset ({reason})");
            }
        }

        /// <summary>
        /// Reset all cascades.
        /// </summary>
        public void ResetAll(string reason = "Manual reset all")
        {
            foreach (var cascade in _activeCascades.Values)
            {
                cascade.Reset();
            }

            if (_policy.EnableDebugLogging())
            {
                _journal?.Debug($"[Cascade] All cascades reset ({reason})");
            }
        }

        /// <summary>
        /// Update cascade state (call on each bar to check expirations).
        /// </summary>
        public void Update()
        {
            foreach (var state in _activeCascades.Values)
            {
                // Check expiration
                if (state.HTF_SweepDetected && DateTime.Now > state.ExpiresAt)
                {
                    if (!state.IsComplete)
                    {
                        _journal?.Debug($"[Cascade] {state.Name}: Timeout (no MSS confirmation within {state.TimeoutMinutes}m)");
                        state.Reset();
                    }
                }
            }
        }

        /// <summary>
        /// Print status of all cascades for debugging.
        /// </summary>
        public void PrintStatus()
        {
            _bot.Print($"╔════════════════════════════════════════╗");
            _bot.Print($"║   CASCADE VALIDATOR STATUS");
            _bot.Print($"╚════════════════════════════════════════╝");

            foreach (var state in _activeCascades.Values)
            {
                _bot.Print($"");
                _bot.Print($"─── {state.Name} ───");
                _bot.Print($"Timeout: {state.TimeoutMinutes} minutes");
                _bot.Print($"");
                _bot.Print($"HTF Sweep: {(state.HTF_SweepDetected ? $"✅ @ {state.HTF_SweepTime:HH:mm:ss}" : "❌")}");
                if (state.HTF_SweepDetected)
                {
                    _bot.Print($"  Level: {state.HTF_SweepLevel:F5}, Direction: {state.HTF_SweepDirection}");
                }

                _bot.Print($"Mid Sweep: {(state.Mid_SweepDetected ? $"✅ @ {state.Mid_SweepTime:HH:mm:ss}" : "❌")}");
                if (state.Mid_SweepDetected)
                {
                    _bot.Print($"  Level: {state.Mid_SweepLevel:F5}, Direction: {state.Mid_SweepDirection}");
                }

                _bot.Print($"LTF MSS: {(state.LTF_MSSDetected ? $"✅ @ {state.LTF_MSSTime:HH:mm:ss}" : "❌")}");
                if (state.LTF_MSSDetected)
                {
                    _bot.Print($"  Direction: {state.LTF_MSSDirection}");
                }

                _bot.Print($"");
                _bot.Print($"Status: {(state.IsValid ? "✅ VALID & COMPLETE" : state.HTF_SweepDetected ? "⏳ PENDING" : "❌ INACTIVE")}");

                if (state.HTF_SweepDetected)
                {
                    var remaining = (state.ExpiresAt - DateTime.Now).TotalMinutes;
                    _bot.Print($"Expires: {state.ExpiresAt:HH:mm:ss} ({remaining:F1}m remaining)");
                }
            }

            _bot.Print($"");
            _bot.Print($"╚════════════════════════════════════════╝");
        }

        /// <summary>
        /// Get bias source cascade name from policy.
        /// </summary>
        public string GetBiasCascadeName()
        {
            return _policy.GetBiasSource();
        }

        /// <summary>
        /// Get execution source cascade name from policy.
        /// </summary>
        public string GetExecutionCascadeName()
        {
            return _policy.GetExecutionSource();
        }

        /// <summary>
        /// Quick check: Is bias cascade valid?
        /// </summary>
        public bool IsBiasCascadeValid()
        {
            return IsCascadeValid(GetBiasCascadeName());
        }

        /// <summary>
        /// Quick check: Is execution cascade valid?
        /// </summary>
        public bool IsExecutionCascadeValid()
        {
            return IsCascadeValid(GetExecutionCascadeName());
        }
    }
}
