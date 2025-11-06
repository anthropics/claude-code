using System;
using System.Collections.Generic;
using cAlgo.API;

namespace CCTTB.Orchestration
{
    /// <summary>
    /// Lightweight, non-invasive orchestrator. Default is pass-through.
    /// </summary>
    public class Orchestrator
    {
        private readonly IOrderGateway _gateway;
        private readonly Robot _robot;

        public bool UseCooldown { get; set; } = false;
        public TimeSpan Cooldown { get; set; } = TimeSpan.Zero;

        public bool UseMaxOpenPositionsPerSymbol { get; set; } = false;
        public int MaxOpenPositionsPerSymbol { get; set; } = 1000;

        public bool UseSessionFilter { get; set; } = false;
        public TimeSpan SessionStart { get; set; } = TimeSpan.Zero;
        public TimeSpan SessionEnd   { get; set; } = TimeSpan.FromHours(24);

        private readonly Dictionary<string, DateTime> _lastOpenUtcByKey = new Dictionary<string, DateTime>();

        // Preset system
        private PresetManager _presetManager;
        private OrchestratorPreset _activePreset;
        private List<OrchestratorPreset> _activePresets = new List<OrchestratorPreset>();
        public ISignalFilter SignalFilter { get; set; }
        public bool UseMultiPresetMode { get; set; } = true; // Enable multi-preset mode by default

        public Orchestrator(Robot robot, IOrderGateway gateway)
        {
            _robot = robot ?? throw new ArgumentNullException(nameof(robot));
            _gateway = gateway ?? throw new ArgumentNullException(nameof(gateway));
        }

        public void ConfigurePresets(PresetManager presetManager, ISignalFilter filter)
        {
            _presetManager = presetManager;
            SignalFilter   = filter;
            RefreshPreset(_robot.Server.Time.ToUniversalTime());
        }

        public void RefreshPreset(DateTime utcNow)
        {
            if (_presetManager == null) return;

            if (UseMultiPresetMode)
            {
                // Multi-preset mode: get all active presets for this time
                _activePresets = _presetManager.GetActivePresets(utcNow);

                // Also update single preset for backward compatibility
                _activePreset = _activePresets.Count > 0 ? _activePresets[0] : null;
            }
            else
            {
                // Legacy single-preset mode
                var next = _presetManager.GetActivePreset(utcNow);
                if (_activePreset == null || !string.Equals(_activePreset.Name, next.Name, StringComparison.OrdinalIgnoreCase))
                {
                    _activePreset = next;
                    this.ApplyPreset(next);
                }
                _activePresets = new List<OrchestratorPreset> { _activePreset };
            }
        }

        public void Submit(TradeSignal signal)
        {
            if (signal == null)
            {
                _robot.Print("[ORCHESTRATOR] BLOCKED: signal is null");
                return;
            }

            _robot.Print($"[ORCHESTRATOR] Submit: {signal.Label} {signal.Direction} @ {signal.EntryPrice:F5}");

            // Keep preset fresh
            RefreshPreset(_robot.Server.Time.ToUniversalTime());

            // Optional session filter
            if (UseSessionFilter)
            {
                var now = _robot.Server.Time.ToUniversalTime();
                var tod = now.TimeOfDay;
                bool inSession = SessionStart <= SessionEnd
                    ? (tod >= SessionStart && tod <= SessionEnd)
                    : (tod >= SessionStart || tod <= SessionEnd);
                if (!inSession)
                {
                    _robot.Print($"[ORCHESTRATOR] BLOCKED: Outside session | Now={tod} | Session={SessionStart}-{SessionEnd}");
                    return;
                }
                _robot.Print($"[ORCHESTRATOR] Session check: PASSED | Now={tod}");
            }

            // Optional cooldown
            if (UseCooldown && Cooldown > TimeSpan.Zero)
            {
                var key = BuildKey(signal);
                var now = _robot.Server.Time.ToUniversalTime();
                if (_lastOpenUtcByKey.TryGetValue(key, out var lastUtc))
                {
                    var elapsed = now - lastUtc;
                    if (elapsed < Cooldown)
                    {
                        _robot.Print($"[ORCHESTRATOR] BLOCKED: Cooldown | Elapsed={elapsed.TotalMinutes:F1}m | Required={Cooldown.TotalMinutes:F1}m");
                        return;
                    }
                }
                _lastOpenUtcByKey[key] = now;
                _robot.Print($"[ORCHESTRATOR] Cooldown check: PASSED");
            }

            // Optional max positions
            if (UseMaxOpenPositionsPerSymbol)
            {
                int openForSymbol = 0;
                if (_robot != null && _robot.Positions != null)
                {
                    foreach (var pos in _robot.Positions)
                    {
                        if (pos.SymbolName == _robot.Symbol.Name)
                            openForSymbol++;
                    }
                }
                if (openForSymbol >= MaxOpenPositionsPerSymbol)
                {
                    _robot.Print($"[ORCHESTRATOR] BLOCKED: Max positions | Open={openForSymbol} | Max={MaxOpenPositionsPerSymbol}");
                    return;
                }
                _robot.Print($"[ORCHESTRATOR] Max positions check: PASSED | Open={openForSymbol}/{MaxOpenPositionsPerSymbol}");
            }

            // Multi-preset evaluation: signal passes if ANY active preset allows it
            if (UseMultiPresetMode && SignalFilter != null && _activePresets != null && _activePresets.Count > 0)
            {
                bool allowedByAnyPreset = false;
                string allowedBy = null;

                _robot.Print($"[ORCHESTRATOR] Checking {_activePresets.Count} active presets...");
                foreach (var preset in _activePresets)
                {
                    bool allowed = SignalFilter.Allow(signal, preset);
                    _robot.Print($"[ORCHESTRATOR]   Preset '{preset.Name}': {(allowed ? "ALLOWED" : "BLOCKED")} | Focus='{preset.Focus}'");
                    if (allowed)
                    {
                        allowedByAnyPreset = true;
                        allowedBy = preset.Name;
                        break;
                    }
                }

                // Killzone fallback: If no preset matched BUT we're in a killzone, allow the signal anyway
                if (!allowedByAnyPreset)
                {
                    var utcNow = _robot.Server.Time.ToUniversalTime();
                    bool inKillzone = IsInKillzone(utcNow);

                    if (inKillzone)
                    {
                        _robot.Print($"[ORCHESTRATOR] Killzone fallback: No preset matched, but in killzone → ALLOWING signal");
                        allowedByAnyPreset = true;
                        allowedBy = "Killzone_Fallback";
                    }
                    else
                    {
                        _robot.Print($"[ORCHESTRATOR] BLOCKED: No preset allows this signal and not in killzone");
                        return; // Blocked by all active presets and not in killzone
                    }
                }

                _robot.Print($"[ORCHESTRATOR] Preset check: PASSED by '{allowedBy}'");

                // Tag signal with the preset that allowed it (optional - only if not fallback)
                if (!string.IsNullOrEmpty(allowedBy) && allowedBy != "Killzone_Fallback")
                {
                    signal.Label = $"{signal.Label}_{allowedBy}";
                }
            }
            else
            {
                // Legacy single-preset mode
                if (SignalFilter != null && _activePreset != null)
                {
                    bool allowed = SignalFilter.Allow(signal, _activePreset);
                    _robot.Print($"[ORCHESTRATOR] Single preset '{_activePreset.Name}': {(allowed ? "ALLOWED" : "BLOCKED")}");
                    if (!allowed) return;
                }
            }

            // Pass-through execution
            _robot.Print($"[ORCHESTRATOR] All checks PASSED → Sending to gateway");
            _gateway.OpenFromSignal(signal);
        }

        private string BuildKey(TradeSignal s)
        {
            // Uses fields your project has (Label, Direction, EntryPrice)
            return $"{_robot.Symbol.Name}|{s.Direction}|{s.EntryPrice:0.0#####}|{(s.Label ?? "?")}";
        }

        /// <summary>
        /// Get names of all currently active presets (for display/logging)
        /// </summary>
        public string GetActivePresetNames()
        {
            if (_activePresets == null || _activePresets.Count == 0)
                return "None";

            return string.Join(", ", System.Linq.Enumerable.Select(_activePresets, p => p.Name));
        }

        /// <summary>
        /// Get count of currently active presets
        /// </summary>
        public int GetActivePresetCount()
        {
            return _activePresets?.Count ?? 0;
        }

        /// <summary>
        /// Check if current UTC time is within any active preset's killzone
        /// </summary>
        public bool IsInKillzone(DateTime utcNow)
        {
            if (_activePresets == null || _activePresets.Count == 0)
                return true; // No restrictions

            return OrchestratorExtensions.IsInAnyKillzone(_activePresets, utcNow.TimeOfDay);
        }

        /// <summary>
        /// Get combined killzone info from all active presets
        /// </summary>
        public (bool useKillzone, TimeSpan start, TimeSpan end) GetKillzoneInfo()
        {
            return OrchestratorExtensions.GetCombinedKillzone(_activePresets);
        }
    }
}
