#define HIDE_LEGACY_PARAMS
using cAlgo.API;
using CCTTB.Orchestration;
using cAlgo.API.Internals;
using cAlgo.API.Indicators;
using System;
using System.Collections.Generic;
using System.Linq;
// using MSSModel = CCTTB.MSS.Models.MSSignal; // not used

// using MSS.Adapter; // removed legacy adapter

namespace CCTTB
{
    [Robot(TimeZone = TimeZones.EasternStandardTime, AccessRights = AccessRights.FullAccess)]
    public class JadecapStrategy : Robot
    {
        private Orchestrator _orc;

        private void EnsureOrchestrator()
        {
            if (_orc == null && _tradeManager != null)
            {
                var gateway = new CCTTB.Orchestration.TradeManagerGatewayAdapter(this, _tradeManager);
                _orc = new CCTTB.Orchestration.Orchestrator(this, gateway);

                // Load presets from JSON folder if available; else fallback to Bootstrap
                var __presetFolder = System.IO.Path.Combine(System.IO.Path.GetDirectoryName(GetType().Assembly.Location) ?? string.Empty, "Presets");
                if (!PresetJsonLoader.TryLoadFromFolder(__presetFolder, out var __presets, out var __schedules, out var __err))
                {
                    var __ps = CCTTB.Orchestration.PresetBootstrap.Build();
                    __presets = __ps.presets; __schedules = __ps.schedules;
                }
                var __pm = new CCTTB.Orchestration.PresetManager(__presets, __schedules);
                _orc.ConfigurePresets(__pm, new CCTTB.Orchestration.LabelContainsFocusFilter());
            }
        }

    [Parameter("Preset", Group = "Profiles", DefaultValue = PresetOption.Asia_Liquidity_Sweep)]
    public PresetOption PresetSelect { get; set; }

    [Parameter("Policy Mode", Group = "Profiles", DefaultValue = PolicyMode.AutoSwitching_Orchestrator)]
    public PolicyMode PolicyModeSelect { get; set; }

    [Parameter("Orchestrator Config Path", Group = "Profiles", DefaultValue = "config/active.json")]
    public string ConfigPath { get; set; }

    [Parameter("Enable HTF Orchestrated Bias/Sweep", Group = "HTF System", DefaultValue = false)]
    public bool EnableHtfOrchestratedSystem { get; set; }

    // Get the actual config path based on PolicyMode selection
    private string GetEffectiveConfigPath()
    {
        switch (PolicyModeSelect)
        {
            case PolicyMode.AutoSwitching_Orchestrator:
                return "config/runtime/policy_universal.json";

            case PolicyMode.Manual_Intelligent_Universal:
            case PolicyMode.Manual_Perfect_Sequence_Hunter:
            case PolicyMode.Manual_Learning_Adaptive:
            case PolicyMode.Manual_Phase4o4_Strict_Enhanced:
                return "config/runtime/policy.json";

            case PolicyMode.Custom_Path:
            default:
                return ConfigPath; // Use manual path
        }
    }

    // Get the preset name for manual modes
    private string GetEffectivePresetName()
    {
        switch (PolicyModeSelect)
        {
            case PolicyMode.Manual_Intelligent_Universal:
                return "Intelligent_Universal";

            case PolicyMode.Manual_Perfect_Sequence_Hunter:
                return "Perfect_Sequence_Hunter";

            case PolicyMode.Manual_Learning_Adaptive:
                return "Learning_Adaptive";

            case PolicyMode.Manual_Phase4o4_Strict_Enhanced:
                return "phase4o4_strict_ENHANCED";

            default:
                return null; // Auto-switching or custom
        }
    }

    // Orchestrator config state
    private ActiveConfig _cfg;
    private DateTime _lastCfgWrite;





        // Video alignment note: See docs/VIDEO_ALIGNMENT.md for which parameters to enable/disable
        // to match specific Phase4o4 Shorts (PO3, Killzones, 3-Confirm, SMT, PingPong, etc.).
        // -- Local transient state --
        private sealed class LocalState
        {
            public BiasDirection LastCtBias = BiasDirection.Neutral;
            public BiasDirection? LastHTFBias = null; // CRITICAL FIX (Oct 25): Persist HTF bias after confirmation
            public DateTime LastDailyResetDate = DateTime.MinValue; // Track daily reset for HTF bias

            public Queue<double> SpreadPips = new Queue<double>();
            // Break tracking for pullback gating
            public BiasDirection BreakDir = BiasDirection.Neutral;
            public double BreakLevel = double.NaN; // high for bull break, low for bear break
            public int BreakBarIndex = -1;        // index of break bar (last closed when detected)
            public int BreakExpiryBar = -1;       // bars.Count index threshold when state expires
            public int LastEntryBarIndex = -100000; // cooldown tracking
            public bool SequenceFallbackUsed = false; // last sequence validation used relaxed path

            // Re-entry state
            public double LastOteLo = double.NaN;
            public double LastOteHi = double.NaN;
            public BiasDirection LastEntryDir = BiasDirection.Neutral;
            public int ReEntryCount = 0;
            public int ReEntryCooldownUntilBar = -1;

            // Asia session (PO3) state
            public DateTime AsiaStartToday = DateTime.MinValue;
            public DateTime AsiaEndToday = DateTime.MinValue;
            public double AsiaHigh = double.NaN;
            public double AsiaLow = double.NaN;
            public int AsiaSweepDir = 0; // +1 swept up (above AsiaHigh), -1 swept down (below AsiaLow), 0 none
            public int AsiaSweepBarIndex = -1;
            public bool AsiaRangeTooWide = false;

            // Risk Management & Circuit Breaker
            public DateTime TradingDisabledUntil = DateTime.MinValue;
            public DateTime DailyResetDate = DateTime.MinValue;
            public double DailyStartingBalance = 0;
            public int DailyTradeCount = 0;
            public int ConsecutiveLosses = 0;
            public DateTime CooldownUntil = DateTime.MinValue;

            // Performance Tracking
            public Dictionary<string, int> DetectorWins = new Dictionary<string, int>();
            public Dictionary<string, int> DetectorLosses = new Dictionary<string, int>();
            public Dictionary<string, int> DetectorTotal = new Dictionary<string, int>();
            public Dictionary<string, DateTime> PositionEntryTimes = new Dictionary<string, DateTime>();
            public Dictionary<string, double> PositionConfidences = new Dictionary<string, double>(); // ADVANCED FEATURE: Track confidence per position
            public int TotalClosedTrades = 0;  // ADVANCED FEATURE: Track total closed trades for diagnostic reporting
            public int LastDiagnosticTradeCount = 0; // ADVANCED FEATURE: Track when last diagnostic was generated

            // MSS Lifecycle Tracking (first MSS after sweep - locked until entry or opposite liquidity touched)
            public MSSSignal ActiveMSS = null;              // First MSS after sweep (locked)
            public DateTime ActiveMSSTime = DateTime.MinValue;
            public LiquiditySweep ActiveSweep = null;       // Sweep that triggered active MSS
            public bool MSSEntryOccurred = false;           // Entry happened on active MSS
            public bool OppositeLiquidityTouched = false;   // Opposite liquidity reached
            public double OppositeLiquidityLevel = 0;       // Target opposite liquidity price

            // OTE Lifecycle Tracking (locked to ActiveMSS - only one OTE per MSS)
            public OTEZone ActiveOTE = null;                // OTE zone from active MSS (locked)
            public DateTime ActiveOTETime = DateTime.MinValue;

            // Multi-Timeframe Cascade (Chart TF = Liquidity, Lower TF = MSS)
            public Bars MSSBars = null;                     // Lower timeframe bars for MSS detection
            public TimeFrame ChartTimeframe;                 // Chart timeframe (for liquidity)
            public TimeFrame MSSTimeframe;                   // Lower timeframe (for MSS)
            public List<SignalBox> TouchedBoxes = new List<SignalBox>();  // Track which OTE/OB boxes have been touched for re-entry
        }

        // Signal box tracking for multi-entry support
        public class SignalBox
        {
            public string Type { get; set; }         // "OTE" or "OB" or "FVG"
            public string UniqueId { get; set; }     // Unique identifier: "OTE_timestamp" or "OB_timestamp"
            public DateTime Time { get; set; }       // When signal was created
            public double Low { get; set; }          // Box low price
            public double High { get; set; }         // Box high price
            public BiasDirection Direction { get; set; } // Bullish or Bearish
            public bool Touched { get; set; }        // Has price touched this box yet
            public DateTime? TouchTime { get; set; } // When was it touched
            public bool EntryTaken { get; set; }     // Has an entry been taken from this box
            public DateTime? EntryTime { get; set; } // When was entry taken
            public object SourceSignal { get; set; } // Reference to original OTEZone or OrderBlock
        }

        private readonly LocalState _state = new LocalState();
        // —— Modules ——

        // —— Config & services ——
        private StrategyConfig _config;

        /// <summary>
        /// Map unified policy enums to existing granular flags for backward compatibility.
        /// This centralizes behavior and prevents duplicate/contradictory gates.
        /// </summary>
        private void ApplyUnifiedPolicies()
        {
            try
            {
                // —— Entry gate mapping ——
                switch (_config.EntryGateMode)
                {
                    case EntryGateMode.Any:
                        // Legacy remains as-is
                        break;
                    case EntryGateMode.MSSOnly:
                        _config.RequireMSSForEntry = true;
                        _config.RequireMSSandOTE = false;
                        _config.EnableMultiConfirmation = false;
                        _config.UseScoring = false;
                        break;
                    case EntryGateMode.MSS_and_OTE:
                        _config.RequireMSSForEntry = true;
                        _config.RequireMSSandOTE = true;
                        _config.EnableMultiConfirmation = false;
                        _config.UseScoring = false;
                        break;
                    case EntryGateMode.Triple:
                        _config.RequireMSSForEntry = true;
                        _config.RequireMSSandOTE = false;
                        _config.EnableMultiConfirmation = true;
                        _config.ConfirmationMode = EntryConfirmationModeEnum.Triple;
                        _config.UseScoring = false;
                        break;
                    case EntryGateMode.Scoring:
                        _config.UseScoring = true;
                        _config.EnableMultiConfirmation = false;
                        _config.RequireMSSandOTE = false;
                        break;
                }

        
    


                // —— OTE policy mapping ——
                // Normalize legacy flags first
                _config.EnableContinuationReanchorOTE = false;
                _config.StrictOteAfterMssCompletion = false;
                _config.RequireOteAlways = false;
                _config.RequireOteIfAvailable = false;

                switch (_config.OtePolicy)
                {
                    case OtePolicy.None:
                        // no explicit requirement
                        break;
                    case OtePolicy.IfAvailable:
                        _config.RequireOteIfAvailable = true;
                        break;
                    case OtePolicy.Always:
                        _config.RequireOteAlways = true;
                        break;
                    case OtePolicy.StrictAfterMSS:
                        _config.StrictOteAfterMssCompletion = true; // sequence gate enforced
                        _config.RequireMSSandOTE = true;
                        break;
                    case OtePolicy.ContinuationReanchor:
                        _config.EnableContinuationReanchorOTE = true;
                        // ensure re-entry window is sane; keep existing ReEntry* otherwise
                        if (!_config.EnableReEntry) _config.EnableReEntry = true;
                        break;
                }

                // —— Sweep scope mapping ——
                _config.RequirePDH_PDL_SweepOnly = false;
                _config.RequireInternalSweep = false;
                _config.RequireWeeklySweep = false;
                switch (_config.SweepScope)
                {
                    case SweepScope.Any:
                        break;
                    case SweepScope.PDH_PDL_Only:
                        _config.RequirePDH_PDL_SweepOnly = true;
                        break;
                    case SweepScope.Internal_Only:
                        _config.RequireInternalSweep = true;
                        break;
                    case SweepScope.Weekly_Only:
                        _config.RequireWeeklySweep = true;
                        break;
                }

                // —— TP target policy mapping ——
                _config.UseOppositeLiquidityTP = false;
                _config.UseWeeklyLiquidityTP = false;
                _config.EnableInternalLiquidityFocus = false;
                switch (_config.TpTargetPolicy)
                {
                    case TpTargetPolicy.OppositeLiquidity:
                        _config.UseOppositeLiquidityTP = true;
                        break;
                    case TpTargetPolicy.WeeklyHighLow:
                        _config.UseWeeklyLiquidityTP = true;
                        break;
                    case TpTargetPolicy.InternalBoundary:
                        _config.EnableInternalLiquidityFocus = true;
                        break;
                    case TpTargetPolicy.Manual:
                        // leave all off, rely on explicit TP or RR
                        break;
                }
            }
            catch { /* guard: do not break robot on mapping */ }
        }

        /// <summary>
        /// Normalize all session time settings to SERVER UTC if user indicates server is UTC.
        /// This avoids double offsets when Robot attribute TimeZone differs from server clock.
        /// </summary>
        private void NormalizeSessionsToServerUtc()
        {
            try
            {
                // If the user wants pure UTC, force preset and disable DST adjustments
                if (_config != null && _config.SessionUseServerUTC)
                {
                    _config.SessionTimeZonePreset = SessionTimeZonePreset.ServerUTC;
                    _config.SessionDstAutoAdjust = false;
                    // Parameters removed - using hardcoded UTC values

                    // If KillZone hours were defined relative to EST, translate them to UTC defaults commonly used:
                    // NY (13:30–17:00 UTC for RTH open window) — keep user-configurable strings but recommend UTC values
                    // We won't override user's exact strings; only ensure downstream computations treat them as UTC.
                }
            }
            catch { /* no-op */ }
        }


        private bool LoadPresetFromJson(string name)
        {
            try
            {
                if (string.IsNullOrWhiteSpace(name)) return false;
                var fileSafe = name.Trim().Replace(" ", "_").ToLowerInvariant();
                string presetsDir = System.IO.Path.Combine(GetRootPath(), "docs", "presets");
                // Additional fallbacks in case docs/presets is not copied next to the build
                var exeDir = System.IO.Path.GetDirectoryName(System.Reflection.Assembly.GetExecutingAssembly().Location);
                var srcDir = System.IO.Path.Combine(exeDir ?? string.Empty, "..", "..", "docs", "presets");
                var cwdDir = System.IO.Path.Combine(Environment.CurrentDirectory, "docs", "presets");
                string[] candidates = new[] {
                    System.IO.Path.Combine(exeDir ?? string.Empty, "docs", "presets", fileSafe + ".json"),
                    System.IO.Path.Combine(exeDir ?? string.Empty, "docs", "presets", name + ".json"),
                    srcDir,
                    cwdDir,
                    System.IO.Path.Combine(presetsDir, fileSafe + ".json"),
                    System.IO.Path.Combine(presetsDir, name + ".json")
                };

                foreach (var path in candidates)
                {
                    if (System.IO.File.Exists(path))
                    {
                        var json = System.IO.File.ReadAllText(path);
                        // parse to map and store until _config exists; do not apply directly here
                        var map = ParseSimpleJson(json);
                        if (map != null && map.Count > 0)
                        {
                            _loadedPresetMap = map;
                            return true;
                        }
                        return false;
                    }
                }
            }
            catch (Exception ex)
            {
                Print("Preset load failed: {0}", ex.Message);
            }
            return false;
        }

        private string GetRootPath()
        {
            try
            {
                // Try to derive from assembly location; fallback to working directory
                var codebase = this.GetType().Assembly.Location;
                if (!string.IsNullOrEmpty(codebase))
                {
                    var dir = System.IO.Path.GetDirectoryName(codebase);
                    if (!string.IsNullOrEmpty(dir)) return dir;
                }
            }
            catch { }
            return System.IO.Directory.GetCurrentDirectory();
        }

        /// <summary>
        /// OCT 27 SWING LEARNING: Get current trading session for swing quality tracking
        /// </summary>
        private string GetCurrentSession()
        {
            var hour = Server.Time.Hour;

            // London: 08:00-17:00 UTC
            if (hour >= 8 && hour < 17) return "London";

            // NY: 13:00-22:00 UTC (overlaps with London)
            if (hour >= 13 && hour < 22) return "NY";

            // Asia: 00:00-09:00 UTC
            if (hour >= 0 && hour < 9) return "Asia";

            return "Other";
        }

        private bool ApplyPresetJson(string json)
        {
            try
            {
                // Minimal JSON extraction without external deps
                // Expect simple key:value pairs for the known fields
                var map = ParseSimpleJson(json);

                string s;
                if (map.TryGetValue("EntryGateMode", out s))
                    _config.EntryGateMode = (EntryGateMode)Enum.Parse(typeof(EntryGateMode), s, true);
                if (map.TryGetValue("OtePolicy", out s))
                    _config.OtePolicy = (OtePolicy)Enum.Parse(typeof(OtePolicy), s, true);
                if (map.TryGetValue("SweepScope", out s))
                    _config.SweepScope = (SweepScope)Enum.Parse(typeof(SweepScope), s, true);
                if (map.TryGetValue("TpTargetPolicy", out s))
                    _config.TpTargetPolicy = (TpTargetPolicy)Enum.Parse(typeof(TpTargetPolicy), s, true);

                if (map.TryGetValue("BiasAlign", out s))
                {
                    var enumVal = s.Equals("Strict", StringComparison.OrdinalIgnoreCase) ? BiasAlignModeEnum.Strict : BiasAlignModeEnum.Loose;
                    try
                    {
                        var prop = _config?.GetType().GetProperty("BiasAlignMode");
                        if (prop != null && prop.CanWrite)
                        {
                            if (prop.PropertyType.IsEnum)
                            {
                                prop.SetValue(_config, Enum.Parse(prop.PropertyType, enumVal.ToString()));
                            }
                            else if (prop.PropertyType == typeof(BiasAlignModeEnum))
                            {
                                prop.SetValue(_config, enumVal);
                            }
                        }
                    }
                    catch
                    {
                        // ignore: optional property not present or incompatible with this build
                    }
                }

                // Optional: strict sequence toggle used by many presets
                if (map.TryGetValue("StrictSequence", out s))
                {
                    if (bool.TryParse(s, out var seq))
                        _config.StrictSequence = seq;
                    else
                    {
                        // Some presets use 0/1 or strings; accept 'false'/'true' or numeric
                        if (int.TryParse(s, out var n)) _config.StrictSequence = (n != 0);
                        else _config.StrictSequence = string.Equals(s, "false", StringComparison.OrdinalIgnoreCase) ? false : _config.StrictSequence;
                    }
                }

                if (map.TryGetValue("Session", out s))
                {
                    if (s.Equals("NY", StringComparison.OrdinalIgnoreCase) || s.Contains("NewYork"))
                        _config.SessionTimeZonePreset = SessionTimeZonePreset.NewYork;
                    else if (s.Equals("London", StringComparison.OrdinalIgnoreCase))
                        _config.SessionTimeZonePreset = SessionTimeZonePreset.London;
                    else if (s.Equals("Asia", StringComparison.OrdinalIgnoreCase) || s.Equals("Tokyo", StringComparison.OrdinalIgnoreCase))
                        _config.SessionTimeZonePreset = SessionTimeZonePreset.Tokyo;
                }

                if (map.TryGetValue("NewsFilter", out s))
                {
                    // Support several common values: Off, AllowOnlyPostNews, AllowPost (legacy)
                    if (s.IndexOf("AllowOnlyPostNews", StringComparison.OrdinalIgnoreCase) >= 0
                        || s.IndexOf("AllowPost", StringComparison.OrdinalIgnoreCase) >= 0)
                    {
                        _config.NewsAllowOnlyPost = true;
                        _config.NewsBlockWithinMinutes = 0;
                        int delay;
                        if (map.TryGetValue("NewsDelayMinutes", out var d) && int.TryParse(d, out delay))
                            _config.NewsPostDelayMinutes = delay;
                    }
                    else if (s.Equals("Off", StringComparison.OrdinalIgnoreCase) || s.Equals("None", StringComparison.OrdinalIgnoreCase))
                    {
                        _config.NewsAllowOnlyPost = false;
                        _config.NewsBlockWithinMinutes = 0;
                        _config.NewsPostDelayMinutes = 0;
                    }
                }

                return true;
            }
            catch (Exception ex)
            {
                Print("Preset apply failed: {0}", ex.Message);
                return false;
            }
        }

        private Dictionary<string,string> ParseSimpleJson(string json)
        {
            var dict = new Dictionary<string,string>(StringComparer.OrdinalIgnoreCase);
            if (string.IsNullOrWhiteSpace(json)) return dict;
            // VERY simple parser for flat string/number values
            string s = json;
            // Remove braces
            s = s.Trim();
            if (s.StartsWith("{")) s = s.Substring(1);
            if (s.EndsWith("}")) s = s.Substring(0, s.Length-1);
            // Split on commas not inside quotes (cheap approach)
            var parts = s.Split(new[] {','}, StringSplitOptions.RemoveEmptyEntries);
            foreach (var p in parts)
            {
                var kv = p.Split(new[] {':'}, 2);
                if (kv.Length != 2) continue;
                var key = kv[0].Trim().Trim('"');
                var val = kv[1].Trim().Trim('"');
                // Remove trailing quotes or commas
                val = val.Trim();
                dict[key] = val;
            }
            return dict;
        }

        private MarketDataProvider _marketData;
        private System.Collections.Generic.Dictionary<string,string> _loadedPresetMap = null;
        private bool _presetAppliedFromJson = false;

        // OCT 27 ADAPTIVE LEARNING INTEGRATION
        private AdaptiveLearningEngine _learningEngine;

        private void ApplyLoadedPresetToConfig()
        {
            if (_loadedPresetMap == null || _config == null) return;
            var map = _loadedPresetMap;
            try
            {
                string s;
                if (map.TryGetValue("EntryGateMode", out s))
                    _config.EntryGateMode = (EntryGateMode)Enum.Parse(typeof(EntryGateMode), s, true);
                if (map.TryGetValue("OtePolicy", out s))
                    _config.OtePolicy = (OtePolicy)Enum.Parse(typeof(OtePolicy), s, true);
                if (map.TryGetValue("SweepScope", out s))
                    _config.SweepScope = (SweepScope)Enum.Parse(typeof(SweepScope), s, true);
                if (map.TryGetValue("TpTargetPolicy", out s))
                    _config.TpTargetPolicy = (TpTargetPolicy)Enum.Parse(typeof(TpTargetPolicy), s, true);

                if (map.TryGetValue("StrictSequence", out s))
                {
                    if (bool.TryParse(s, out var seq)) _config.StrictSequence = seq;
                    else if (int.TryParse(s, out var n)) _config.StrictSequence = (n != 0);
                }

                if (map.TryGetValue("NewsFilter", out s))
                {
                    if (s.IndexOf("AllowOnlyPostNews", StringComparison.OrdinalIgnoreCase) >= 0 || s.IndexOf("AllowPost", StringComparison.OrdinalIgnoreCase) >= 0)
                    {
                        _config.NewsAllowOnlyPost = true;
                        _config.NewsBlockWithinMinutes = 0;
                    }
                    else if (s.Equals("Off", StringComparison.OrdinalIgnoreCase) || s.Equals("None", StringComparison.OrdinalIgnoreCase))
                    {
                        _config.NewsAllowOnlyPost = false;
                        _config.NewsBlockWithinMinutes = 0;
                    }
                }

                _presetAppliedFromJson = true;
            }
            catch (Exception ex)
            {
                Print("ApplyLoadedPresetToConfig failed: {0}", ex.Message);
            }
        }

        private string MapPreset(PresetOption p)
        {
            switch (p)
            {
                case PresetOption.None: return string.Empty;
                case PresetOption.NY_Strict_InternalOnly: return "ny_strict_internal";
                case PresetOption.PostNews_Continuation: return "postnews_continuation";
                case PresetOption.Asia_Liquidity_Sweep: return "asia_liquidity_sweep";
                case PresetOption.NY_Strict_TripleSequence: return "ny_strict_triple";
                case PresetOption.PostNews_TripleStrict: return "postnews_triple_strict";
                case PresetOption.Asia_Internal_Mechanical: return "asia_internal_mechanical";
                case PresetOption.Asia_Internal_StrictMechanical: return "asia_internal_strict_mechanical";
                case PresetOption.London_Internal_Mechanical: return "london_internal_mechanical";
                case PresetOption.London_Internal_StrictMechanical: return "london_internal_strict_mechanical";
                case PresetOption.London_Triple_Strict: return "london_triple_strict";
                case PresetOption.Weekly_Focused: return "weekly_focused";
                case PresetOption.London_Weekly_Focused: return "london_weekly_focused";
                case PresetOption.NY_Weekly_Focused: return "ny_weekly_focused";
                case PresetOption.Asia_Weekly_Focused: return "asia_weekly_focused";
                case PresetOption.NY_Strict: return "ny_strict_internal";
                case PresetOption.NY_Strict_Triple: return "ny_strict_triple";
                case PresetOption.Phase4o4_NY_Strict: return "phase4o4_ny_strict";
                case PresetOption.Phase4o4_Pingpong_Range: return "phase4o4_pingpong_range";
                case PresetOption.Phase4o4_PO3_Strict: return "phase4o4_po3_strict";
                case PresetOption.Phase4o4_SMT_Filter: return "phase4o4_smt_filter";
                case PresetOption.Phase4o4_Strict_Preset: return "phase4o4_strict_preset";
                case PresetOption.Phase4o4_Triple_Confirm: return "phase4o4_triple_confirm";
                case PresetOption.Phase4o4_Video_Strict: return "phase4o4_video_strict";
                case PresetOption.PostNews_Triple_Strict: return "postnews_triple_strict";
                case PresetOption.Asia_Internal_Mechanical_Alt: return "asia_internal_mechanical";
                default: return string.Empty;
            }
        }

        // —— Detectors ——
        private MSSignalDetector _mssDetector;
        private LiquiditySweepDetector _sweepDetector;
        private OrderBlockDetector _obDetector;
        private OptimalTradeEntryDetector _oteDetector;

        // ═══════════════════════════════════════════════════════════════════
        // HTF BIAS/SWEEP ORCHESTRATION SYSTEM (NEW)
        // ═══════════════════════════════════════════════════════════════════
        private HtfMapper _htfMapper;
        private HtfDataProvider _htfDataProvider;
        private LiquidityReferenceManager _liquidityRefManager;
        private BiasStateMachine _biasStateMachine;
        private OrchestratorGate _orchestratorGate;
        private CompatibilityValidator _compatibilityValidator;

        private bool _htfSystemEnabled = false;  // Toggle: false = use old system, true = use new HTF system
        private TimeFrame _htfPrimary;
        private TimeFrame _htfSecondary;

        // INTELLIGENT BIAS SYSTEM (Oct 25) - Works on ANY timeframe
        private IntelligentBiasAnalyzer _intelligentAnalyzer;
        private BiasDashboard _biasDashboard;
        private bool _useIntelligentBias = true; // Enable intelligent multi-TF bias

        // MSS ORCHESTRATOR (Oct 25) - Dual-timeframe MSS (15M → 5M)
        private MSSOrchestrator _mssOrchestrator;
        private HTF_MSS_Detector _htfMssDetector;
        private LTF_MSS_Detector _ltfMssDetector;
        private bool _useMSSOrchestrator = false; // Enable MSS orchestrator system

        // —— Execution ——
        private TradeManager _tradeManager;
        private RiskManager _riskManager;
        private EntryConfirmation _entryConfirmation;

        // ═══════════════════════════════════════════════════════════════════
        // CIRCUIT BREAKER PROTECTION
        // ═══════════════════════════════════════════════════════════════════
        private int _consecutiveLosses = 0;
        private bool _circuitBreakerActive = false;
        private DateTime _pauseTradingUntil = DateTime.MinValue;

        // ═══════════════════════════════════════════════════════════════════
        // PHASED STRATEGY COMPONENTS (WEEK 1 ENHANCEMENT)
        // ═══════════════════════════════════════════════════════════════════
        private PhasedPolicySimple _phasedPolicy;
        private SweepBufferCalculator _sweepBuffer;
        private OTETouchDetector _oteTouchDetector;
        private CascadeValidator _cascadeValidator;
        private PhaseManager _phaseManager;
        private BiasDirection _lastSetPhaseBias = BiasDirection.Neutral; // Track last bias set to PhaseManager

        // ═══════════════════════════════════════════════════════════════════
        // PHASE 2: MARKET REGIME DETECTION
        // ═══════════════════════════════════════════════════════════════════
        private DirectionalMovementSystem _adx;
        private AverageTrueRange _atr;
        private MarketRegime _currentRegime = MarketRegime.Ranging;

        // ═══════════════════════════════════════════════════════════════════
        // ADVANCED FEATURE: NUANCED EXIT LOGIC
        // ═══════════════════════════════════════════════════════════════════
        private RelativeStrengthIndex _rsi;

        // ═══════════════════════════════════════════════════════════════════
        // ADVANCED FEATURE: PATTERN RECOGNITION
        // ═══════════════════════════════════════════════════════════════════
        private PatternRecognition _patternRecognizer;

        // ═══════════════════════════════════════════════════════════════════
        // ADVANCED FEATURE: SELF-DIAGNOSIS & ADAPTIVE TUNING
        // ═══════════════════════════════════════════════════════════════════
        private SelfDiagnosis _selfDiagnosis;

        // ═══════════════════════════════════════════════════════════════════
        // ADVANCED FEATURE: ENHANCED INTERMARKET ANALYSIS
        // ═══════════════════════════════════════════════════════════════════
        private IntermarketAnalysis _intermarketAnalysis;

        // ═══════════════════════════════════════════════════════════════════
        // ADVANCED FEATURE: NEWS & EVENT AWARENESS
        // ═══════════════════════════════════════════════════════════════════
        private NewsAwareness _newsAwareness;  // Legacy simple news detection
        private SmartNewsAnalyzer _smartNews; // NEW: Smart contextual news analysis
        private NewsContextAnalysis _currentNewsContext;
        private System.Threading.Timer _analysisTimer; // NEW: Timer for API calls
        private object _analysisLock = new object(); // NEW: For thread safety

        // CRASH FIX: Track initialization state to prevent duplicate subscriptions
        private bool _isInitialized = false;
        private bool _timerStarted = false;

        // ═══════════════════════════════════════════════════════════════════
        // ADVANCED FEATURE: MULTI-TIMEFRAME BIAS INTEGRATION
        // ═══════════════════════════════════════════════════════════════════
        private MTFBiasSystem _mtfBias;
        private BiasConfluence _currentBiasConfluence;

        // ═══════════════════════════════════════════════════════════════════
        // ADVANCED FEATURE: PRICE ACTION DYNAMICS ANALYZER
        // ═══════════════════════════════════════════════════════════════════
        private PriceActionAnalyzer _priceActionAnalyzer;
        private PriceActionAnalyzer.PriceActionAnalysis _currentMSSQuality;
        private PriceActionAnalyzer.PriceActionAnalysis _currentPullbackQuality;

        // ═══════════════════════════════════════════════════════════════════
        // CHANGE #2: STRUCTURAL STOP LOSS CALCULATOR (OCT 30, 2025)
        // ═══════════════════════════════════════════════════════════════════
        private StructuralSLCalculator _structuralSL;

        // ═══════════════════════════════════════════════════════════════════
        // UNIFIED CONFIDENCE SYSTEM - Context Storage
        // ═══════════════════════════════════════════════════════════════════
        private List<MSSSignal> _currentMssSignals;
        private List<LiquiditySweep> _currentSweeps;
        private bool? _currentSmtDirection;

        // —— Visualization & logging ——
        private DrawingTools _drawer;
        private TradeJournal _journal;

        // ========== Parameters ==========
        // Deprecated: BiasTimeFrameOption caused duplication with BiasTfParam. Keep hidden or remove.
        // [Obsolete("Use BiasTfParam instead")] // cTrader ignores Obsolete in params; remove attribute
        // Removed to avoid duplicate bias configuration per 5.4.9 guidelines.



        [Parameter("Enable Phase4o4 strict mode", Group = "Strategy", DefaultValue = false)]
        public bool Phase4o4StrictMode { get; set; }

        [Parameter("Bias TF (Pro-Trend)", Group = "Bias", DefaultValue = "Hour")]
        public TimeFrame BiasTfParam { get; set; } // uses cAlgo.API.TimeFrame

        [Parameter("Bias Confirmation Bars", Group = "Bias", DefaultValue = 2, MinValue = 1)]
        public int BiasConfirmationBarsParam { get; set; }

        // Legacy CT-bias parameters removed

        [Parameter("Enable Intraday Bias (DayOpen+sweep+shift)", Group = "Bias", DefaultValue = false)]
        public bool EnableIntradayBiasParam { get; set; }

        [Parameter("Intraday Bias TF", Group = "Bias", DefaultValue = "Minute15")]
        public TimeFrame IntradayBiasTfParam { get; set; }

        [Parameter("MSS Break Type", Group = "MSS", DefaultValue = MSSBreakTypeEnum.Both)]
        public MSSBreakTypeEnum MSSBreakTypeParam { get; set; }

        [Parameter("Body Percent Threshold", Group = "MSS", DefaultValue = 60.0, MinValue = 0, MaxValue = 100)]
        public double BodyPercentThreshold { get; set; }

        [Parameter("Wick Threshold", Group = "MSS", DefaultValue = 25.0, MinValue = 0, MaxValue = 100)]
        public double WickThreshold { get; set; }

        [Parameter("Both Threshold", Group = "MSS", DefaultValue = 65.0, MinValue = 0, MaxValue = 100)]
        public double BothThreshold { get; set; }

    [Parameter("Enable Multi Confirmation", Group = "Entry", DefaultValue = true)]
    public bool EnableMultiConfirmation { get; set; }

    [Parameter("Confirmation Mode", Group = "Entry", DefaultValue = EntryConfirmationModeEnum.Double)]
    public EntryConfirmationModeEnum ConfirmationModeParam { get; set; }

    [Parameter("Entry Preset (A/B/C)", Group = "Entry", DefaultValue = EntryPresetEnum.None)]
    public EntryPresetEnum EntryPresetParam { get; set; }

    [Parameter("Preset Name", Group = "Profiles", DefaultValue = "")]
    public string PresetNameParam { get; set; }

    [Parameter("Profile", Group = "Profiles", DefaultValue = ProfilePresetEnum.None)]
    public ProfilePresetEnum ProfileParam { get; set; }

[Parameter("Require MSS to Enter", Group = "MSS", DefaultValue = true)]
    public bool RequireMSSForEntry { get; set; }
[Parameter("Count MSS Once", Group = "MSS", DefaultValue = true)]
        public bool CountMSSOnce { get; set; }

        [Parameter("MSS Debounce (bars)", Group = "MSS", DefaultValue = 3, MinValue = 0)]
        public int MssDebounceBars { get; set; }

        [Parameter("Require Retest to FOI", Group = "MSS", DefaultValue = false)]
        public bool RequireRetestToFOI { get; set; }

        // —— Optional feature toggles ——
        [Parameter("Align MSS With Bias", Group = "MSS", DefaultValue = false)]
        public bool UseTimeframeAlignment { get; set; }


        // Entry location discipline
        [Parameter("Require swing discount/premium", Group = "Entry", DefaultValue = false)]
        public bool RequireSwingDiscountPremiumParam { get; set; }

        [Parameter("Require POI key-level interaction", Group = "Entry", DefaultValue = false)]
        public bool RequirePoiKeyLevelInteractionParam { get; set; }

        [Parameter("Key-level tolerance (pips)", Group = "Entry", DefaultValue = 1.0, MinValue = 0.0)]
        public double KeyLevelTolerancePipsParam { get; set; }

        [Parameter("KeyValid: PDH/PDL", Group = "Entry", DefaultValue = true)]
        public bool KeyValidUsePDH_PDLParam { get; set; }

        [Parameter("KeyValid: CDH/CDL", Group = "Entry", DefaultValue = true)]
        public bool KeyValidUseCDH_CDLParam { get; set; }

        [Parameter("KeyValid: EQH/EQL", Group = "Entry", DefaultValue = true)]
        public bool KeyValidUseEQH_EQLParam { get; set; }

        [Parameter("KeyValid: PWH/PWL", Group = "Entry", DefaultValue = true)]
        public bool KeyValidUsePWH_PWLParam { get; set; }

        // Visual toggles
        [Parameter("Show Mon/Tue overlay", Group = "Visual", DefaultValue = true)]
        public bool ShowMonTueOverlayParam { get; set; }

        [Parameter("Show internal sweep labels", Group = "Visual", DefaultValue = true)]
        public bool ShowInternalSweepLabelsParam { get; set; }

        [Parameter("Colorize key-level labels", Group = "Visual", DefaultValue = true)]
        public bool ColorizeKeyLabelsParam { get; set; }

        [Parameter("Show BOS arrows", Group = "Visual", DefaultValue = true)]
        public bool ShowBOSArrowsParam { get; set; }

        [Parameter("Show impulse zones", Group = "Visual", DefaultValue = true)]
        public bool ShowImpulseZonesParam { get; set; }

        [Parameter("Show Liquidity Side labels", Group = "Visual", DefaultValue = true)]
        public bool ShowLiquiditySideLabelsParam { get; set; }

        [Parameter("Key label color PD", Group = "Visual", DefaultValue = "Goldenrod")]
        public string KeyColorPDParam { get; set; }

        [Parameter("Key label color CD", Group = "Visual", DefaultValue = "Gray")]
        public string KeyColorCDParam { get; set; }

        [Parameter("Key label color EQ", Group = "Visual", DefaultValue = "SlateGray")]
        public string KeyColorEQParam { get; set; }


        [Parameter("Summary position", Group = "Visual", DefaultValue = "TopCenter")]
        public string SummaryPositionParam { get; set; }

        [Parameter("Legend position", Group = "Visual", DefaultValue = "TopRight")]
        public string LegendPositionParam { get; set; }

        [Parameter("Require internal sweeps only", Group = "Entry", DefaultValue = false)]
        public bool RequireInternalSweepParam { get; set; }

        [Parameter("Internal-liquidity focus (TP)", Group = "Entry", DefaultValue = false)]
        public bool InternalLiquidityFocusParam { get; set; }

        // —— Scoring ——
    [Parameter("Use Scoring Mode", Group = "Scoring", DefaultValue = false)]
    public bool UseScoring { get; set; }
//[Parameter("Score Min Total", Group = "Scoring", DefaultValue = 3, MinValue = 1)]
        public int ScoreMinTotal { get; set; }

        //[Parameter("Score: MSS", Group = "Scoring", DefaultValue = 2, MinValue = 0)]
        public int Score_MSS { get; set; }

        //[Parameter("Score: MSS_Retest", Group = "Scoring", DefaultValue = 1, MinValue = 0)]
        public int Score_MSS_Retest { get; set; }

        //[Parameter("Score: OTE", Group = "Scoring", DefaultValue = 1, MinValue = 0)]
        public int Score_OTE { get; set; }

        //[Parameter("Score: OB", Group = "Scoring", DefaultValue = 1, MinValue = 0)]
        public int Score_OB { get; set; }

        //[Parameter("Score: Sweep", Group = "Scoring", DefaultValue = 1, MinValue = 0)]
        public int Score_Sweep { get; set; }

        //[Parameter("Score: Default (other tags)", Group = "Scoring", DefaultValue = 1, MinValue = 0)]
        public int Score_Default { get; set; }

        // —— Execution & visual & risk ——
        [Parameter("Enable Scaling Entries", Group = "Execution", DefaultValue = true)]
        public bool EnableScalingEntries { get; set; }

        [Parameter("Enable Dynamic StopLoss", Group = "Execution", DefaultValue = true)]
        public bool EnableDynamicStopLoss { get; set; }

        [Parameter("Risk Percent", Group = "Risk", DefaultValue = 0.4, MinValue = 0.1, MaxValue = 5)]
        public double RiskPercent { get; set; }

        [Parameter("Tap Tolerance (pips)", Group = "Entry", DefaultValue = 1.0, MinValue = 0.1)]
        public double TapTolerancePipsParam { get; set; }

        [Parameter("Require Dual Tap", Group = "Entry", DefaultValue = false)]
        public bool RequireDualTapParam { get; set; }

        [Parameter("Dual Tap Pair", Group = "Entry", DefaultValue = DualTapPairEnum.OTE_OB)]
        public DualTapPairEnum DualTapPairParam { get; set; }

        [Parameter("Overlap Tolerance (pips)", Group = "Entry", DefaultValue = 1.0, MinValue = 0.0)]
        public double DualTapOverlapPipsParam { get; set; }

        [Parameter("Min Risk/Reward", Group = "Risk", DefaultValue = 0.75, MinValue = 0.5, MaxValue = 10)]
        public double MinRiskReward { get; set; }

        [Parameter("Min Stop Clamp (pips)", Group = "Risk", DefaultValue = 20.0, MinValue = 0.1)]
        public double MinStopClampPipsParam { get; set; }

        [Parameter("Max Volume (units)", Group = "Risk", DefaultValue = 300000, MinValue = 1000)]
        public int MaxVolumeUnitsParam { get; set; }

        [Parameter("Max Concurrent Positions", Group = "Risk", DefaultValue = 2, MinValue = 1)]
        public int MaxConcurrentPositionsParam { get; set; }

        [Parameter("Enable Circuit Breaker", Group = "Risk", DefaultValue = true)]
        public bool EnableCircuitBreaker { get; set; }

        [Parameter("Max Consecutive Losses", Group = "Risk", DefaultValue = 3, MinValue = 2, MaxValue = 10)]
        public int MaxConsecutiveLosses { get; set; }

        [Parameter("Circuit Breaker Pause (Minutes)", Group = "Risk", DefaultValue = 240, MinValue = 30, MaxValue = 1440)]
        public int CircuitBreakerPauseMinutes { get; set; }

        [Parameter("Cooldown Bars After Entry", Group = "Execution", DefaultValue = 3, MinValue = 0)]
        public int CooldownBarsAfterEntryParam { get; set; }

        [Parameter("Enable POI Box Draw", Group = "Visual", DefaultValue = true)]
        public bool EnablePOIBoxDraw { get; set; }

        [Parameter("Max FVG Boxes", Group = "Visual", DefaultValue = 6, MinValue = 1)]
        public int MaxFVGBoxesParam { get; set; }

        [Parameter("FVG Color", Group = "Visual", DefaultValue = "Goldenrod")]
        public string FVGColorParam { get; set; }

        [Parameter("Breaker Color", Group = "Visual", DefaultValue = "OrangeRed")]
        public string BreakerColorParam { get; set; }


        [Parameter("OTE Box Extras (mid/EQ/fib)", Group = "Visual", DefaultValue = false)]
        public bool OteDrawExtras { get; set; }

        [Parameter("Enable FVG Drawing", Group = "Visual", DefaultValue = false)]
        public bool EnableFvgDrawing { get; set; }

        [Parameter("Enable MSS Fib-Pack", Group = "Visual", DefaultValue = false)]
        public bool EnableMssFibPack { get; set; }

        [Parameter("POI Priority (e.g. OTE>FVG>OB>Breaker)", Group = "Entry", DefaultValue = "OTE")]
        public string PoiPriorityOrderParam { get; set; }

        [Parameter("Enable Sweep-MSS OTE", Group = "Entry", DefaultValue = true)]
        public bool EnableSweepMssOte { get; set; }

        [Parameter("Sweep-MSS Extension Bars", Group = "Entry", DefaultValue = 3, MinValue = 0)]
        public int SweepMssExtensionBarsParam { get; set; }

        [Parameter("Sweep-MSS OTE Color", Group = "Visual", DefaultValue = "LightSkyBlue")]
        public string SweepMssOteColorParam { get; set; }

        [Parameter("Require OTE if available", Group = "Entry", DefaultValue = false)]
        public bool RequireOteIfAvailableParam { get; set; }

        // --- Debug ---
        [Parameter("Enable Debug Logging", Group = "Debug", DefaultValue = false)]
        public bool EnableDebugLoggingParam { get; set; }

        [Parameter("Enable File Logging", Group = "Debug", DefaultValue = false)]
        public bool EnableFileLoggingParam { get; set; }

        [Parameter("Require OTE always", Group = "Entry", DefaultValue = false)]
        public bool RequireOteAlwaysParam { get; set; }

        [Parameter("Enable Killzone Gate", Group = "Entry", DefaultValue = false)]
        public bool EnableKillzoneGateParam { get; set; }

        [Parameter("Include PDH/PDL as liquidity zones", Group = "Entry", DefaultValue = true)]
        public bool IncludePrevDayLevelsAsZonesParam { get; set; }

        [Parameter("Require PDH/PDL sweeps only", Group = "Entry", DefaultValue = false)]
        public bool RequirePdhPdlSweepOnlyParam { get; set; }

        // Liquidity pools: equal highs/lows and current-day range
[Parameter("Include Equal High/Low zones", Group = "Entry", DefaultValue = true)]
        public bool IncludeEqualHighsLowsAsZonesParam { get; set; }
[Parameter("EQH/EQL tolerance (pips)", Group = "Entry", DefaultValue = 1.0, MinValue = 0.0)]
        public double EqTolerancePipsParam { get; set; }
[Parameter("EQH/EQL lookback (bars)", Group = "Entry", DefaultValue = 50, MinValue = 5)]
        public int EqLookbackBarsParam { get; set; }
[Parameter("Include Current Day H/L", Group = "Entry", DefaultValue = true)]
        public bool IncludeCurrentDayLevelsAsZonesParam { get; set; }

[Parameter("Allow EQH/EQL sweeps", Group = "Entry", DefaultValue = true)]
        public bool AllowEqhEqlSweepsParam { get; set; }
[Parameter("Allow CDH/CDL sweeps", Group = "Entry", DefaultValue = true)]
        public bool AllowCdhCdlSweepsParam { get; set; }


        [Parameter("Skip double sweep in killzone", Group = "Entry", DefaultValue = true)]
        public bool SkipDoubleSweepInKillzoneParam { get; set; }


        // Triple confirmation (MSS+Breaker+IFVG)
[Parameter("Require MSS+Breaker+IFVG", Group = "Entry", DefaultValue = false)]
        public bool RequireTripleConfirmationParam { get; set; }

        // PingPong (range mode)
        //[Parameter("Enable PingPong (range mode)", Group = "Entry", DefaultValue = false)]
        public bool EnablePingPongModeParam { get; set; }

        //[Parameter("PingPong max range (pips)", Group = "Entry", DefaultValue = 30.0, MinValue = 5)]
        public double PingPongMaxRangePipsParam { get; set; }

        //[Parameter("PingPong min bounce (pips)", Group = "Entry", DefaultValue = 5.0, MinValue = 0.5)]
        public double PingPongMinBouncePipsParam { get; set; }


        // News blackout
        //[Parameter("Enable News Blackout", Group = "News", DefaultValue = false)]
        public bool EnableNewsBlackoutParam { get; set; }

        //[Parameter("Blackout windows (HH:mm-HH:mm;..)", Group = "News", DefaultValue = "")] 
        public string NewsBlackoutWindowsParam { get; set; }

        // Breaker / SL-TP / Re-entry / Weekly bias
        [Parameter("Require Breaker Retest", Group = "Entry", DefaultValue = false)]
        public bool RequireBreakerRetestParam { get; set; }

        [Parameter("Breaker entry at 50%", Group = "Entry", DefaultValue = true)]
        public bool BreakerEntryAtMidParam { get; set; }

        [Parameter("Stop at FOI edge", Group = "Stops", DefaultValue = true)]
        public bool StopUseFOIEdgeParam { get; set; }

        [Parameter("Enable Re-entry on retap", Group = "Entry", DefaultValue = true)]
        public bool EnableReEntryParam { get; set; }

        [Parameter("Re-entry max attempts", Group = "Entry", DefaultValue = 1, MinValue = 0)]
        public int ReEntryMaxParam { get; set; }

        [Parameter("Re-entry within (bars)", Group = "Entry", DefaultValue = 30, MinValue = 1)]
        public int ReEntryWithinBarsParam { get; set; }

        [Parameter("Re-entry cooldown (bars)", Group = "Entry", DefaultValue = 3, MinValue = 0)]
        public int ReEntryCooldownBarsParam { get; set; }


        // News mode (trade only during windows)
        [Parameter("Enable News Mode (trade only in windows)", Group = "News", DefaultValue = false)]
        public bool EnableNewsModeOnlyParam { get; set; }

        [Parameter("News trade windows (HH:mm-HH:mm;..)", Group = "News", DefaultValue = "")] 
        public string NewsTradeWindowsParam { get; set; }


        [Parameter("Enable Sequence Gate", Group = "Entry", DefaultValue = false)]
        public bool EnableSequenceGateParam { get; set; }

        [Parameter("Sequence Lookback (bars)", Group = "Entry", DefaultValue = 200, MinValue = 1)]
        public int SequenceLookbackBarsParam { get; set; }

        [Parameter("Require Micro Break", Group = "Entry", DefaultValue = false)]
        public bool RequireMicroBreakParam { get; set; }

        [Parameter("Require Pullback After Break", Group = "Entry", DefaultValue = false)]
        public bool RequirePullbackAfterBreakParam { get; set; }

        [Parameter("Pullback Min (pips)", Group = "Entry", DefaultValue = 0.5, MinValue = 0.0)]
        public double PullbackMinPipsParam { get; set; }

        [Parameter("Enable Continuation OTE (re-anchor)", Group = "Entry", DefaultValue = false)]
        public bool EnableContinuationReanchorOTEParam { get; set; }

        [Parameter("Allow Sequence Fallback", Group = "Entry", DefaultValue = false)]
        public bool AllowSequenceGateFallbackParam { get; set; }

        [Parameter("Break Reference", Group = "Entry", DefaultValue = BreakRefMode.PrevCandle)]
        public BreakRefMode BreakReferenceParam { get; set; }

        [Parameter("Strict OTE after MSS completion", Group = "Entry", DefaultValue = true)]
        public bool StrictOteAfterMssCompletionParam { get; set; }

        [Parameter("Break Lookback (bars)", Group = "Entry", DefaultValue = 20, MinValue = 1)]
        public int BreakLookbackBarsParam { get; set; }

        [Parameter("Sequence OB Color", Group = "Visual", DefaultValue = "DeepSkyBlue")]
        public string SequenceObColorParam { get; set; }

        [Parameter("Seq Stop Extra (pips)", Group = "Stops", DefaultValue = 1.0, MinValue = 0)]
        public double StopExtraPipsSeqParam { get; set; }

        [Parameter("Use Opposite Liquidity TP", Group = "Risk", DefaultValue = true)]
        public bool UseOppositeLiquidityTPParam { get; set; }

        [Parameter("TP Offset (pips)", Group = "Risk", DefaultValue = 1.0, MinValue = 0)]
        public double TpOffsetPipsParam { get; set; }

        // --- Risk guardrails & TP cushion ---
        [Parameter("Min SL Floor (pips)", Group = "Risk", DefaultValue = 5.0, MinValue = 0)]
        public double MinSlPipsFloorParam { get; set; }

        [Parameter("ATR Sanity Enabled", Group = "Risk", DefaultValue = true)]
        public bool EnforceAtrSanityParam { get; set; }

        [Parameter("ATR Period", Group = "Risk", DefaultValue = 14, MinValue = 2)]
        public int AtrPeriodParam { get; set; }

        [Parameter("ATR Sanity Factor", Group = "Risk", DefaultValue = 0.25, MinValue = 0.05, MaxValue = 1.0)]
        public double AtrSanityFactorParam { get; set; }

        [Parameter("TP Spread Cushion Enabled", Group = "Risk", DefaultValue = true)]
        public bool EnableTpSpreadCushionParam { get; set; }

        [Parameter("Spread Cushion Extra (pips)", Group = "Risk", DefaultValue = 0.2, MinValue = 0)]
        public double SpreadCushionExtraPipsParam { get; set; }

        [Parameter("Use Avg Spread Cushion", Group = "Risk", DefaultValue = false)]
        public bool SpreadCushionUseAvgParam { get; set; }

        [Parameter("Spread Avg Period", Group = "Risk", DefaultValue = 10, MinValue = 1)]
        public int SpreadAvgPeriodParam { get; set; }

        [Parameter("Show Box Labels", Group = "Visual", DefaultValue = true)]
        public bool ShowBoxLabelsParam { get; set; }

        [Parameter("Default Leverage Assumption", Group = "Risk", DefaultValue = 30.0, MinValue = 1)]
        public double DefaultLeverageAssumptionParam { get; set; }

        [Parameter("Enable Margin Check", Group = "Risk", DefaultValue = true)]
        public bool EnableMarginCheckParam { get; set; }

        [Parameter("Max Margin Utilization", Group = "Risk", DefaultValue = 0.5, MinValue = 0.05, MaxValue = 1.0)]
        public double MarginUtilizationMaxParam { get; set; }

        [Parameter("Enforce Notional Cap", Group = "Risk", DefaultValue = false)]
        public bool EnforceNotionalCapParam { get; set; }

        [Parameter("Notional Cap Multiple", Group = "Risk", DefaultValue = 2.0, MinValue = 0.5, MaxValue = 10.0)]
        public double NotionalCapMultipleParam { get; set; }

        // Advanced Risk Management
        [Parameter("Enable Circuit Breaker", Group = "Risk", DefaultValue = true)]
        public bool EnableCircuitBreakerParam { get; set; }

        [Parameter("Daily Loss Limit %", Group = "Risk", DefaultValue = 6.0, MinValue = 1.0, MaxValue = 10.0)]
        public double DailyLossLimitPercentParam { get; set; }

        [Parameter("Max Daily Trades", Group = "Risk", DefaultValue = 4, MinValue = 1, MaxValue = 20)]
        public int MaxDailyTradesParam { get; set; }

        [Parameter("Max Time In Trade (hours)", Group = "Risk", DefaultValue = 8.0, MinValue = 1.0, MaxValue = 24.0)]
        public double MaxTimeInTradeHoursParam { get; set; }

        [Parameter("Enable Trade Clustering Prevention", Group = "Risk", DefaultValue = true)]
        public bool EnableClusteringPreventionParam { get; set; }

        [Parameter("Cooldown After Losses", Group = "Risk", DefaultValue = 2, MinValue = 1, MaxValue = 5)]
        public int CooldownAfterLossesParam { get; set; }

        [Parameter("Cooldown Duration (hours)", Group = "Risk", DefaultValue = 4.0, MinValue = 0.5, MaxValue = 24.0)]
        public double CooldownDurationHoursParam { get; set; }

        [Parameter("Use HTF OBs", Group = "OrderBlocks", DefaultValue = true)]
        public bool UseHtfOrderBlocks { get; set; }

        [Parameter("HTF OB TimeFrame", Group = "OrderBlocks", DefaultValue = "Hour")]
        public TimeFrame HtfObTfParam { get; set; }

        [Parameter("Nested OB TimeFrame", Group = "OrderBlocks", DefaultValue = "Minute15")]
        public TimeFrame NestedObTfParam { get; set; }

        [Parameter("Bullish Color", Group = "Visual", DefaultValue = "Green")]
        public string BullishColorParam { get; set; }

        [Parameter("Bearish Color", Group = "Visual", DefaultValue = "Red")]
        public string BearishColorParam { get; set; }

        [Parameter("Stop Buffer OTE (pips)", Group = "Stops", DefaultValue = 15.0, MinValue = 0.0)]
        public double StopBufferOTEParam { get; set; }

        [Parameter("Stop Buffer OB (pips)", Group = "Stops", DefaultValue = 10.0, MinValue = 0.0)]
        public double StopBufferOBParam { get; set; }

        [Parameter("Stop Buffer FVG (pips)", Group = "Stops", DefaultValue = 10.0, MinValue = 0.0)]
        public double StopBufferFVGParam { get; set; }

        // ===== Trade Mgmt UI (BE/Partial/Trailing) =====
        [Parameter("Enable BreakEven", Group = "Trade Mgmt", DefaultValue = true)]
        public bool PM_EnableBreakEven { get; set; }

        [Parameter("BE Trigger RR", Group = "Trade Mgmt", DefaultValue = 1.0, MinValue = 0)]
        public double PM_BreakEvenTriggerRR { get; set; }

        [Parameter("BE Trigger Pips (opt)", Group = "Trade Mgmt", DefaultValue = 0.0, MinValue = 0)]
        public double PM_BreakEvenTriggerPips { get; set; }

        [Parameter("BE Offset Pips", Group = "Trade Mgmt", DefaultValue = 0.0, MinValue = 0)]
        public double PM_BreakEvenOffsetPips { get; set; }

        [Parameter("Enable Partial Close", Group = "Trade Mgmt", DefaultValue = true)]
        public bool PM_EnablePartial { get; set; }

        [Parameter("Partial at RR", Group = "Trade Mgmt", DefaultValue = 1.0, MinValue = 0)]
        public double PM_PartialRR { get; set; }

        [Parameter("Partial at Pips (opt)", Group = "Trade Mgmt", DefaultValue = 0.0, MinValue = 0)]
        public double PM_PartialPips { get; set; }

        [Parameter("Partial %", Group = "Trade Mgmt", DefaultValue = 50.0, MinValue = 1, MaxValue = 100)]
        public double PM_PartialPercent { get; set; }

        [Parameter("Enable Trailing Stop", Group = "Trade Mgmt", DefaultValue = true)]
        public bool PM_EnableTrailing { get; set; }

        [Parameter("Trail Start RR", Group = "Trade Mgmt", DefaultValue = 1.0, MinValue = 0)]
        public double PM_TrailStartRR { get; set; }

        [Parameter("Trail Start Pips (opt)", Group = "Trade Mgmt", DefaultValue = 0.0, MinValue = 0)]
        public double PM_TrailStartPips { get; set; }

        [Parameter("Trail Distance (pips)", Group = "Trade Mgmt", DefaultValue = 20.0, MinValue = 1)]
        public double PM_TrailDistancePips { get; set; }

        // ========== Helper Methods ==========

        /// <summary>
        /// LOAD MSS POLICY - Loads MSS orchestrator configuration from policy.json
        /// </summary>
        private MSSPolicyConfig LoadMSSPolicy()
        {
            // Create default MSS policy (can be extended to load from JSON later)
            return new MSSPolicyConfig
            {
                EnableDebugLogging = EnableDebugLoggingParam,
                HTF = new MSSPolicyConfig.HTFConfig
                {
                    TF = "15m",
                    WindowCandles = 20,
                    MinDispBodyFactor = 1.5,
                    MinAtrZ = 0.8
                },
                LTF = new MSSPolicyConfig.LTFConfig
                {
                    TF = "5m",
                    ConfirmWithinCandles = 10,
                    RequireLocalSweep = true,
                    MinCloseBeyond = 0.05,
                    RefinePOI = true
                },
                Alignment = new MSSPolicyConfig.AlignmentConfig
                {
                    RequireSameSide = true,
                    CancelOnOppositeHTF = true
                },
                Cooldowns = new MSSPolicyConfig.CooldownsConfig
                {
                    AfterLossMin = 10
                }
            };
        }

        // ========== Lifecycle ==========
        protected override void OnStart()
        {
            // CRASH FIX: Prevent duplicate initialization (InvalidOperationException: Subscription already exists)
            if (_isInitialized)
            {
                Print("[STARTUP] ⚠️ WARNING: OnStart() called multiple times - skipping re-initialization");
                return;
            }

            Print("=== BOT STARTING ===");
            Print($"=== CRASH PROTECTION: IsInitialized={_isInitialized}, TimerStarted={_timerStarted} ===");

            // DIAGNOSTIC: Verify which build is loaded
            Print("╔══════════════════════════════════════════════════════════════╗");
            Print("║   BUILD VERIFICATION - THREADING FIX VERSION                ║");
            Print($"║   Build Date: 2025-11-04 18:15 (NOV 4 - FINAL FIX)        ║");
            Print("║   FIX: cTrader properties captured on main thread           ║");
            Print("║   All threading issues resolved                             ║");
            Print("╚══════════════════════════════════════════════════════════════╝");

            try
            {
                Print("[STARTUP] ========================================");
                Print("[STARTUP] Starting bot initialization...");
                Print($"[STARTUP] Running Mode: {RunningMode}");
                Print($"[STARTUP] Symbol: {SymbolName}");
                Print($"[STARTUP] Timeframe: {TimeFrame}");
                Print("[STARTUP] ========================================");

                // === PHASE 1 DIAGNOSTIC STARTUP ===
                Print("========================================");
                Print("=== PHASE 1 DIAGNOSTIC CHECK ===");
                Print($"=== Bot Version: 2025-10-24-PHASE1 ===");
                Print($"=== Startup Time: {Server.Time} ===");
                Print("========================================");

            // Load orchestrator config first
            var configPath = GetEffectiveConfigPath();
            Print($"[PHASE1] PolicyMode: {PolicyModeSelect}");
            Print($"[PHASE1] Config path: {configPath}");
            Print($"[PHASE1] File exists check: {(System.IO.File.Exists(configPath) ? "YES" : "NO (PROBLEM!)")}");

            ReloadConfigSafe();

            // === PHASE 1 CONFIG CHECK ===
            Print($"[PHASE1] _cfg null check: {(_cfg == null ? "NULL (PROBLEM!)" : "Loaded OK")}");
            if (_cfg != null)
            {
                Print($"[PHASE1] _cfg.oteAdaptive null check: {(_cfg.oteAdaptive == null ? "NULL (PROBLEM!)" : "Loaded OK")}");
                if (_cfg.oteAdaptive != null)
                {
                    Print($"[PHASE1] _cfg.oteAdaptive.enabled: {_cfg.oteAdaptive.enabled}");
                    if (_cfg.oteAdaptive.@base != null)
                    {
                        Print($"[PHASE1] ATR mode: {_cfg.oteAdaptive.@base.mode}");
                        Print($"[PHASE1] ATR period: {_cfg.oteAdaptive.@base.period}");
                        Print($"[PHASE1] ATR multiplier: {_cfg.oteAdaptive.@base.multiplier}");
                    }
                    else
                    {
                        Print("[PHASE1] _cfg.oteAdaptive.base is NULL (PROBLEM!)");
                    }
                }

                Print($"[PHASE1] _cfg.gates null check: {(_cfg.gates == null ? "NULL (PROBLEM!)" : "Loaded OK")}");
                if (_cfg.gates != null)
                {
                    Print($"[PHASE1] _cfg.gates.sequenceGate: {_cfg.gates.sequenceGate}");
                    Print($"[PHASE1] _cfg.gates.relaxAll: {_cfg.gates.relaxAll}");
                    Print($"[PHASE1] _cfg.gates.mssOppLiqGate: {_cfg.gates.mssOppLiqGate}");
                }

                Print($"[PHASE1] orchestratorStamp: {_cfg.orchestratorStamp}");
            }
            Print("========================================");

            // CRASH FIX: Guard Timer.Start() to prevent "Subscription already exists" error
            if (!_timerStarted)
            {
                Print("[TIMER] Starting config reload timer (60 second interval)...");
                Timer.Start(60); // reload config check every 60s
                _timerStarted = true;
                Print("[TIMER] ✅ Config reload timer started");
            }
            else
            {
                Print("[TIMER] ⏭️ SKIPPED: Timer already started (preventing duplicate subscription)");
            }

            if (PresetSelect != PresetOption.None) { var p = MapPreset(PresetSelect); if (!string.IsNullOrEmpty(p)) { if (LoadPresetFromJson(p)) ApplyUnifiedPolicies(); } }

            NormalizeSessionsToServerUtc();

            if (!string.IsNullOrWhiteSpace(PresetNameParam)) { if (LoadPresetFromJson(PresetNameParam)) ApplyUnifiedPolicies(); }

            ApplyUnifiedPolicies();

            // --- CT-MSS module with min-gap wired ---
                {
                    var _mssCfg = new CCTTB.MSSConfig
                {
                    TimeframeLabel = "M5",
                    SwingLookback = 2,
                    MinDisplacementATR = 1.2,
                    MinBodyRatio = 0.6,
                    FvgRequired = true,
                    RetestTimeoutBars = 50,
                    LiqSweepLookback = 5,
                    BreakType = CCTTB.MSSBreakType.Both,
                    WickThresholdPct = 25,
                    BodyPercentThreshold = 60,
                    BothThresholdPct = 65,
                    RequireHtfBias = true,
                    MinFvgGapAbs = Symbol?.PipSize > 0 ? Symbol.PipSize * 2 : 0.0002
                };
            }

            // ——— Strategy config ———
            _config = new StrategyConfig
            {
                // BiasTimeFrame set below from unified BiasTfParam
                KillZoneStart = TimeSpan.FromHours(0),
                KillZoneEnd = TimeSpan.FromHours(24),
                SessionTimeOffsetHours = 0.0,
                SessionDstAutoAdjust = false,
                SessionTimeZoneId = "UTC",
                SessionTimeZonePreset = SessionTimeZonePreset.ServerUTC,

                MSSBreakType = MSSBreakTypeParam,
                BodyPercentThreshold = BodyPercentThreshold,
                WickThreshold = WickThreshold,
                BothThreshold = BothThreshold,

                RequireMSSForEntry = RequireMSSForEntry,
                CountMSSOnce = CountMSSOnce,
                MssDebounceBars = MssDebounceBars,
                RequireRetestToFOI = RequireRetestToFOI,

                UseTimeframeAlignment = UseTimeframeAlignment,
                SessionBehaviorEnable = false,
                RequireOppositeSweep = false,
                OppositeSweepLookback = 5,
                MssMaxAgeBars = 12,

                LondonStart = new TimeSpan(8, 0, 0),
                LondonEnd = new TimeSpan(12, 0, 0),
                NYStart = new TimeSpan(13, 30, 0),
                NYEnd = new TimeSpan(17, 0, 0),
                MssDebounceBars_London = 3,
                MssDebounceBars_NY = 3,
                RequireRetestToFOI_London = false,
                RequireRetestToFOI_NY = false,

                UseScoring = UseScoring,
                ScoreMinTotal = ScoreMinTotal,
                Score_MSS = Score_MSS,
                Score_MSS_Retest = Score_MSS_Retest,
                Score_OTE = Score_OTE,
                Score_OB = Score_OB,
                Score_Sweep = Score_Sweep,
                Score_Default = Score_Default,

                EnableMultiConfirmation = EnableMultiConfirmation,
                ConfirmationMode = ConfirmationModeParam,
                EnableScalingEntries = EnableScalingEntries,
                EnableDynamicStopLoss = EnableDynamicStopLoss,
                EnablePOIBoxDraw = EnablePOIBoxDraw,
                RiskPercent = RiskPercent,
                MinRiskReward = MinRiskReward,
                BullishColor = ParseColor(BullishColorParam),
                BearishColor = ParseColor(BearishColorParam),

                TapTolerancePips = TapTolerancePipsParam,
                StopBufferPipsOTE = StopBufferOTEParam,
                StopBufferPipsOB = StopBufferOBParam,
                StopBufferPipsFVG = StopBufferFVGParam,
                MinStopPipsClamp = MinStopClampPipsParam,
                MaxVolumeUnits = (long)MaxVolumeUnitsParam,
                MaxFVGBoxes = MaxFVGBoxesParam,
                FVGColor = ParseColor(FVGColorParam),
                MaxBreakerBoxes = 8,
                BreakerColor = ParseColor(BreakerColorParam),

                // --- Trade Mgmt ---
                EnableBreakEven = PM_EnableBreakEven,
                BreakEvenTriggerRR = PM_BreakEvenTriggerRR,
                BreakEvenTriggerPips = PM_BreakEvenTriggerPips,
                BreakEvenOffsetPips = PM_BreakEvenOffsetPips,
                EnablePartialClose = PM_EnablePartial,
                PartialCloseRR = PM_PartialRR,
                PartialClosePips = PM_PartialPips,
                PartialClosePercent = PM_PartialPercent,
                EnableTrailingStop = PM_EnableTrailing,
                TrailStartRR = PM_TrailStartRR,
                TrailStartPips = PM_TrailStartPips,
                TrailDistancePips = PM_TrailDistancePips

            };

            // If a preset JSON was loaded earlier, apply it now so it takes precedence
            if (_loadedPresetMap != null && !_presetAppliedFromJson)
            {
                ApplyLoadedPresetToConfig();
            }

            // ——— Init services ———
            // Default/normalize critical fields before wiring services
            if (_config.BiasTimeFrame == default(TimeFrame) || _config.BiasTimeFrame == null)
                _config.BiasTimeFrame = Chart?.TimeFrame ?? TimeFrame.Hour;
            if (_config.BiasTimeFrame == default(TimeFrame) || _config.BiasTimeFrame == null)
                _config.BiasTimeFrame = Chart?.TimeFrame ?? TimeFrame.Minute15;

            if (_config.BullishColor == default(Color)) _config.BullishColor = Color.SeaGreen;
            if (_config.BearishColor == default(Color)) _config.BearishColor = Color.Tomato;
            if (_config.FVGColor == default(Color)) _config.FVGColor = Color.Goldenrod;

            // Initialize multi-timeframe cascade
            _state.ChartTimeframe = Chart?.TimeFrame ?? TimeFrame.Minute15;
            _state.MSSTimeframe = TimeframeCascade.GetMSSTimeframe(_state.ChartTimeframe);

            // Load lower timeframe bars for MSS detection
            try
            {
                _state.MSSBars = MarketData.GetBars(_state.MSSTimeframe, Symbol.Name);
                var cascadeDesc = TimeframeCascade.GetCascadeDescription(_state.ChartTimeframe);
                Print($"[Multi-TF Cascade] {cascadeDesc}");
                Print($"[Multi-TF Cascade] Chart TF: {_state.ChartTimeframe} | MSS TF: {_state.MSSTimeframe}");
            }
            catch (Exception ex)
            {
                Print($"[ERROR] Failed to load MSS timeframe bars: {ex.Message}");
                _state.MSSBars = Bars; // Fallback to chart timeframe
            }

            _marketData = new MarketDataProvider(this, this.MarketData, this.Symbol, _config);
            _mssDetector = new MSSignalDetector(_config, _marketData);

            // (no local adapters required)
            _sweepDetector = new LiquiditySweepDetector(_config);
            _obDetector = new OrderBlockDetector(_config);
            _oteDetector = new OptimalTradeEntryDetector(_config);
            _riskManager = new RiskManager(_config, this.Account);
            _tradeManager = new TradeManager(this, _config, _riskManager);
            _entryConfirmation = new EntryConfirmation(_config);
            _drawer = new DrawingTools(this, this.Chart, _config);
            _journal = new TradeJournal();
            _journal.EnableDebug = EnableDebugLoggingParam;

            // PHASE 2: MARKET REGIME DETECTION - Initialize ADX and ATR
            _adx = Indicators.DirectionalMovementSystem(14);
            _atr = Indicators.AverageTrueRange(14, MovingAverageType.Simple);
            Print("[PHASE 2] Market Regime Detection initialized (ADX period=14)");

            // ADVANCED FEATURE: NUANCED EXIT LOGIC - Initialize RSI for momentum exits
            _rsi = Indicators.RelativeStrengthIndex(Bars.ClosePrices, 14);
            _tradeManager.SetRSI(_rsi);
            _tradeManager.SetATR(_atr); // Share ATR with TradeManager for failure swing detection
            Print("[NUANCED EXITS] RSI indicator initialized (period=14)");

            // ADVANCED FEATURE: PRICE ACTION ANALYZER - Wire to TradeManager for momentum exits
            if (_priceActionAnalyzer != null)
            {
                _tradeManager.SetPriceActionAnalyzer(_priceActionAnalyzer);
                Print("[PRICE ACTION] Price Action Analyzer wired to TradeManager for adaptive exits");
            }

            // ADVANCED FEATURE: PATTERN RECOGNITION - Initialize pattern detector
            _patternRecognizer = new PatternRecognition();
            Print("[PATTERN RECOGNITION] Candlestick pattern detector initialized");

            // ADVANCED FEATURE: SELF-DIAGNOSIS - Initialize component performance tracker
            _selfDiagnosis = new SelfDiagnosis();
            Print("[SELF-DIAGNOSIS] Component performance tracking initialized");

            // ADVANCED FEATURE: INTERMARKET ANALYSIS - Initialize intermarket correlations
            _intermarketAnalysis = new IntermarketAnalysis(this, _config.EnableDebugLogging);
            Print("[INTERMARKET] Intermarket analysis initialized (monitoring bonds, indices, commodities)");

            // ADVANCED FEATURE: NEWS AWARENESS - Initialize news detection and blackout management
            _newsAwareness = new NewsAwareness(this, _atr, NewsBlackoutWindowsParam, _config.EnableDebugLogging);
            Print("[NEWS AWARENESS] News awareness initialized (volatility detection + manual blackouts)");

            // ADVANCED FEATURE: SMART NEWS ANALYZER - Initialize contextual news analysis
            _smartNews = new SmartNewsAnalyzer(this, _config.EnableDebugLogging);
            Print("[SMART NEWS] Smart contextual news analyzer initialized (pre/post analysis, bias validation)");

            // NEW: Initialize Gemini API background timer (15-minute interval)
            if (RunningMode == cAlgo.API.RunningMode.RealTime)
            {
                Print("[GEMINI API] Initializing background timer for live/demo mode...");

                // Initialize with default context
                _currentNewsContext = new NewsContextAnalysis
                {
                    Context = NewsContext.Normal,
                    Reaction = VolatilityReaction.Normal,
                    ConfidenceAdjustment = 0.0,
                    RiskMultiplier = 1.0,
                    BlockNewEntries = false,
                    InvalidateBias = false,
                    Reasoning = "Initializing..."
                };

                // CRITICAL FIX: Capture cTrader API properties on MAIN THREAD before timer callback
                int initialDelayMs = 10000;  // 10 seconds
                int apiIntervalMs = 900000;  // 15 minutes

                _analysisTimer = new System.Threading.Timer(
                    async _ =>
                    {
                        try
                        {
                            // FIX: Capture cTrader properties synchronously on main thread first
                            string capturedAsset = null;
                            DateTime capturedTime = default(DateTime);
                            BiasDirection capturedBias = BiasDirection.Neutral;

                            BeginInvokeOnMainThread(() =>
                            {
                                capturedAsset = SymbolName;
                                capturedTime = Server.TimeInUtc;
                                capturedBias = _marketData?.GetCurrentBias() ?? BiasDirection.Neutral;
                            });

                            // Wait for main thread to capture values
                            await System.Threading.Tasks.Task.Delay(100);

                            // Now call UpdateNewsAnalysis with captured values (safe from background thread)
                            await UpdateNewsAnalysis(capturedAsset, capturedTime, capturedBias);
                        }
                        catch (Exception ex)
                        {
                            // FIX: Wrap Print() calls - this lambda runs on background thread
                            BeginInvokeOnMainThread(() => Print($"[GEMINI API] ERROR in background timer: {ex.Message}"));
                            BeginInvokeOnMainThread(() => Print($"[GEMINI API] Stack: {ex.StackTrace}"));
                        }
                    },
                    null,
                    initialDelayMs,
                    apiIntervalMs
                );

                Print("[GEMINI API] ✅ Background news analysis timer started (15-minute interval)");
            }
            else
            {
                Print("[GEMINI API] ⏭️ SKIPPED: API disabled in backtest/optimization mode");
            }

            // ADVANCED FEATURE: MTF BIAS SYSTEM - Initialize Daily/M15 bias confluence system
            _mtfBias = new MTFBiasSystem(this, _marketData, _config.EnableDebugLogging);
            Print("[MTF BIAS] Multi-Timeframe Bias System initialized (Daily → M15 confluence scoring)");

            // ADVANCED FEATURE: PRICE ACTION ANALYZER - Initialize impulse/correction detection
            _priceActionAnalyzer = new PriceActionAnalyzer(this, Bars, _atr, _config.EnableDebugLogging);
            Print("[PRICE ACTION] Price Action Dynamics Analyzer initialized (impulse/correction, momentum quality)");

            // CHANGE #2: STRUCTURAL STOP LOSS - Initialize (OCT 30, 2025)
            _structuralSL = new StructuralSLCalculator(this, Symbol, EnableDebugLoggingParam);
            Print("[STRUCTURAL SL] Structural Stop Loss Calculator initialized (swing-based invalidation)");

            // OCT 27 ADAPTIVE LEARNING SYSTEM - Initialize
            if (_config.EnableAdaptiveLearning)
            {
                try
                {
                    _learningEngine = new AdaptiveLearningEngine(this, _config.AdaptiveLearningDataPath);
                    Print($"[ADAPTIVE LEARNING] System initialized");
                    Print($"[ADAPTIVE LEARNING] Data path: {_config.AdaptiveLearningDataPath}");
                    Print($"[ADAPTIVE LEARNING] UseAdaptiveScoring: {_config.UseAdaptiveScoring}");
                    Print($"[ADAPTIVE LEARNING] UseAdaptiveParameters: {_config.UseAdaptiveParameters}");

                    if (_config.UseAdaptiveParameters)
                    {
                        Print($"[ADAPTIVE LEARNING] WARNING: Adaptive parameters ENABLED - parameters will auto-adjust");
                        Print($"[ADAPTIVE LEARNING] Learning rate: {_config.AdaptiveLearningRate}, Min trades: {_config.AdaptiveMinTradesRequired}");
                    }
                }
                catch (Exception ex)
                {
                    Print($"[ADAPTIVE LEARNING] Failed to initialize: {ex.Message}");
                    _learningEngine = null;
                }
            }
            else
            {
                Print("[ADAPTIVE LEARNING] Disabled in configuration");
            }

            // INTELLIGENT BIAS SYSTEM (Oct 25) - Initialize
            if (_useIntelligentBias)
            {
                try
                {
                    _intelligentAnalyzer = new IntelligentBiasAnalyzer(this, Symbol);
                    _biasDashboard = new BiasDashboard(this, _intelligentAnalyzer);
                    Print("[INTELLIGENT BIAS] System initialized - works on ANY timeframe");
                    Print($"[INTELLIGENT BIAS] Current chart: {Chart.TimeFrame}");
                }
                catch (Exception ex)
                {
                    Print($"[INTELLIGENT BIAS] Failed to initialize: {ex.Message}");
                    _useIntelligentBias = false;
                }
            }

            // MSS ORCHESTRATOR SYSTEM (Oct 25) - Initialize dual-timeframe MSS (15M → 5M)
            if (_useMSSOrchestrator)
            {
                try
                {
                    // Load MSS policy from config
                    var mssPolicy = LoadMSSPolicy();

                    // Initialize orchestrator
                    _mssOrchestrator = new MSSOrchestrator(this, Symbol, mssPolicy);

                    // Initialize HTF detector (15M)
                    _htfMssDetector = new HTF_MSS_Detector(this, Symbol, _sweepDetector, _mssDetector, _marketData);

                    // Initialize LTF detector (5M)
                    _ltfMssDetector = new LTF_MSS_Detector(this, Symbol, _oteDetector, _marketData);

                    Print("[MSS ORCHESTRATOR] System initialized - 15M bias → 5M entry");
                    Print($"[MSS ORCHESTRATOR] HTF: 15M | LTF: 5M | Chart: {Chart.TimeFrame}");
                }
                catch (Exception ex)
                {
                    Print($"[MSS ORCHESTRATOR] Failed to initialize: {ex.Message}");
                    _useMSSOrchestrator = false;
                }
            }

            if (EnableDebugLoggingParam)
            {
                _journal.SetPrintSink(msg =>
                {
                    try { Print(msg); } catch { }
                });
            }

            // ═══════════════════════════════════════════════════════════════════
            // INITIALIZE HTF BIAS/SWEEP SYSTEM
            // ═══════════════════════════════════════════════════════════════════
            if (EnableHtfOrchestratedSystem)
            {
                try
                {
                    Print("[HTF SYSTEM] Initializing HTF Bias/Sweep orchestration...");

                    // 1. Create mapper
                    _htfMapper = new HtfMapper();

                    // 2. Check if chart TF supported
                    if (!_htfMapper.IsSupported(this.TimeFrame))
                    {
                        Print($"[HTF SYSTEM] WARNING: Chart TF {this.TimeFrame} not supported. Use 5m or 15m. HTF system DISABLED.");
                        _htfSystemEnabled = false;
                    }
                    else
                    {
                        // 3. Get HTF pair
                        var (primary, secondary) = _htfMapper.GetHtfPair(this.TimeFrame);
                        _htfPrimary = primary;
                        _htfSecondary = secondary;
                        Print($"[HTF SYSTEM] Chart TF: {this.TimeFrame} → HTF: {primary}/{secondary}");

                        // 4. Create HTF data provider
                        _htfDataProvider = new HtfDataProvider(this, Symbol, MarketData);

                        // 5. Create reference manager
                        _liquidityRefManager = new LiquidityReferenceManager(this, Symbol, _htfDataProvider, _htfMapper);

                        // 6. Create orchestrator gate
                        string logDir = System.IO.Path.Combine(
                            Environment.GetFolderPath(Environment.SpecialFolder.MyDocuments),
                            "cAlgo", "Data", "cBots", "CCTTB", "data", "logs"
                        );
                        string eventLogPath = System.IO.Path.Combine(logDir, "orchestrator_events.jsonl");
                        _orchestratorGate = new OrchestratorGate(this, _config, eventLogPath);

                        // 7. Create compatibility validator
                        _compatibilityValidator = new CompatibilityValidator(this);

                        // 8. Run compatibility check
                        bool compatible = _compatibilityValidator.ValidateAll(
                            _orchestratorGate,
                            _htfMapper,
                            _htfDataProvider,
                            _liquidityRefManager,
                            this.TimeFrame
                        );

                        Print(_compatibilityValidator.GetValidationReport());

                        if (!compatible)
                        {
                            Print("[HTF SYSTEM] COMPATIBILITY CHECK FAILED - HTF system DISABLED");
                            _htfSystemEnabled = false;

                            // Emit compatibility error
                            var failedChecks = _compatibilityValidator.GetFailedChecks();
                            var issues = new List<string>();
                            foreach (var check in failedChecks)
                            {
                                issues.Add(check.Message);
                            }
                            _orchestratorGate.EmitCompatibilityReport("error", issues);
                        }
                        else
                        {
                            // 9. Create state machine
                            _biasStateMachine = new BiasStateMachine(
                                this,
                                Symbol,
                                _htfDataProvider,
                                _liquidityRefManager,
                                _orchestratorGate,
                                _config
                            );
                            _biasStateMachine.Initialize(_htfPrimary, _htfSecondary);

                            // 10. Perform handshake
                            _orchestratorGate.PerformHandshake(
                                version: "2.0.0",
                                tfMapChecksum: $"{this.TimeFrame}→{primary}/{secondary}",
                                thresholdsChecksum: "default"
                            );

                            _htfSystemEnabled = true;
                            Print("[HTF SYSTEM] ✓ ENABLED - State machine active, gates enforced");
                        }
                    }
                }
                catch (Exception ex)
                {
                    Print($"[HTF SYSTEM] INITIALIZATION ERROR: {ex.Message}");
                    Print($"[HTF SYSTEM] Stack: {ex.StackTrace}");
                    _htfSystemEnabled = false;
                }
            }
            else
            {
                Print("[HTF SYSTEM] Disabled by parameter. Using legacy bias/sweep.");
                _htfSystemEnabled = false;
            }

            // Unify bias timeframe source to BiasTfParam only
            _config.BiasTimeFrame = BiasTfParam;
            _config.BiasConfirmationBars = Math.Max(1, BiasConfirmationBarsParam);
            _config.EnableIntradayBias = EnableIntradayBiasParam;
            _config.IntradayBiasTimeFrame = IntradayBiasTfParam;
            _config.RequireSwingDiscountPremium = RequireSwingDiscountPremiumParam;
            _config.RequirePOIKeyLevelInteraction = RequirePoiKeyLevelInteractionParam;
            _config.KeyLevelInteractionPips = KeyLevelTolerancePipsParam;
            _config.KeyValidUsePDH_PDL = KeyValidUsePDH_PDLParam;
            _config.KeyValidUseCDH_CDL = KeyValidUseCDH_CDLParam;
            _config.KeyValidUseEQH_EQL = KeyValidUseEQH_EQLParam;
            _config.KeyValidUsePWH_PWL = KeyValidUsePWH_PWLParam;
            _config.RequireInternalSweep = RequireInternalSweepParam;
            _config.EnableInternalLiquidityFocus = InternalLiquidityFocusParam;
            if (!_presetAppliedFromJson)
            {
                _config.EntryPreset = EntryPresetParam;
                _config.ProfilePreset = ProfileParam;
            }
            _config.ShowMonTueOverlay = ShowMonTueOverlayParam;
            _config.ShowInternalSweepLabels = ShowInternalSweepLabelsParam;
            _config.ColorizeKeyLevelLabels = ColorizeKeyLabelsParam;
            _config.ShowBOSArrows = ShowBOSArrowsParam;
            _config.ShowImpulseZones = ShowImpulseZonesParam;
            _config.ShowLiquiditySideLabels = ShowLiquiditySideLabelsParam;
            _config.KeyColorPD = ParseColor(KeyColorPDParam);
            _config.KeyColorCD = ParseColor(KeyColorCDParam);
            _config.KeyColorEQ = ParseColor(KeyColorEQParam);
            _config.KeyColorWK = Color.MediumPurple;
            _config.SummaryPosition = SummaryPositionParam ?? "TopCenter";
            _config.LegendPosition = LegendPositionParam ?? "TopRight";
            // Visual/OB toggles
            _config.EnableFVGDraw = EnableFvgDrawing;
            _config.EnableMssFibPack = EnableMssFibPack;
            _config.PoiPriorityOrder = string.IsNullOrWhiteSpace(PoiPriorityOrderParam) ? _config.PoiPriorityOrder : PoiPriorityOrderParam.Trim();
            _config.EnableSweepMssOte = EnableSweepMssOte;
            _config.SweepMssExtensionBars = SweepMssExtensionBarsParam;
            _config.SweepMssOteColor = ParseColor(SweepMssOteColorParam);
            _config.RequireOteIfAvailable = RequireOteIfAvailableParam;
            _config.RequireOteAlways = RequireOteAlwaysParam;
            _config.EnableSequenceGate = EnableSequenceGateParam;
            _config.SequenceLookbackBars = SequenceLookbackBarsParam;
            _config.RequireMicroBreak = RequireMicroBreakParam;
            _config.RequirePullbackAfterBreak = RequirePullbackAfterBreakParam;
            _config.PullbackMinPips = PullbackMinPipsParam;
            _config.EnableContinuationReanchorOTE = EnableContinuationReanchorOTEParam;
            _config.AllowSequenceGateFallback = AllowSequenceGateFallbackParam;

            // NEW: Override gates from config file if loaded
            if (_cfg != null && _cfg.gates != null)
            {
                // Apply config gates (override parameters)
                if (!_cfg.gates.relaxAll)
                {
                    _config.EnableSequenceGate = _cfg.gates.sequenceGate;
                    _config.RequireMicroBreak = _cfg.gates.microBreakGate;
                    _config.RequirePullbackAfterBreak = _cfg.gates.pullbackRequirement;

                    if (_config.EnableDebugLogging)
                        _journal.Debug($"[CONFIG GATES] Applied from config: SequenceGate={_cfg.gates.sequenceGate}, MSSGate={_cfg.gates.mssOppLiqGate}, RelaxAll={_cfg.gates.relaxAll}");
                }
            }
            _config.EnableDebugLogging = EnableDebugLoggingParam;
            _config.BreakReference = BreakReferenceParam;
            _config.StrictOteAfterMssCompletion = StrictOteAfterMssCompletionParam;
            _config.BreakLookbackBars = BreakLookbackBarsParam;
            _config.SequenceObColor = ParseColor(SequenceObColorParam);
            _config.StopExtraPipsSeq = StopExtraPipsSeqParam;
            _config.UseOppositeLiquidityTP = UseOppositeLiquidityTPParam;
            _config.TpOffsetPips = TpOffsetPipsParam;
            _config.RequireDualTap = RequireDualTapParam;
            _config.DualTapPair = DualTapPairParam;
            _config.DualTapOverlapPips = DualTapOverlapPipsParam;
            _config.EnableKillzoneGate = EnableKillzoneGateParam;
            _config.IncludePrevDayLevelsAsZones = IncludePrevDayLevelsAsZonesParam;
            _config.RequirePdhPdlSweepOnly = RequirePdhPdlSweepOnlyParam;
            _config.IncludeEqualHighsLowsAsZones = IncludeEqualHighsLowsAsZonesParam;
            _config.EqTolerancePips = EqTolerancePipsParam;
            _config.EqLookbackBars = EqLookbackBarsParam;
            _config.IncludeCurrentDayLevelsAsZones = IncludeCurrentDayLevelsAsZonesParam;
            _config.IncludeWeeklyLevelsAsZones = false;
            _config.AllowEqhEqlSweeps = AllowEqhEqlSweepsParam;
            _config.AllowCdhCdlSweeps = AllowCdhCdlSweepsParam;
            _config.AllowWeeklySweeps = false;
            _config.EnablePO3 = false;
            _config.AsiaStart = new TimeSpan(0,0,0);
            _config.AsiaEnd = new TimeSpan(5,0,0);
            _config.RequireAsiaSweepBeforeEntry = false;
            _config.PO3LookbackBars = 100;
            _config.AsiaRangeMaxAdrPct = 60.0;
            _config.AdrPeriod = 10;
            _config.SkipDoubleSweepInKillzone = SkipDoubleSweepInKillzoneParam;
            _config.RequireTripleConfirmation = RequireTripleConfirmationParam;
            _config.EnablePingPongMode = EnablePingPongModeParam;
            _config.PingPongMaxRangePips = PingPongMaxRangePipsParam;
            _config.PingPongMinBouncePips = PingPongMinBouncePipsParam;
            _config.EnableSMT = false;
            _config.SMT_CompareSymbol = "";
            _config.SMT_TimeFrame = TimeFrame.Hour;
            _config.SMT_AsFilter = false;
            _config.SMT_Pivot = 2;
            _config.EnableNewsBlackout = EnableNewsBlackoutParam;
            _config.NewsBlackoutWindows = NewsBlackoutWindowsParam;
            _config.RequireBreakerRetest = RequireBreakerRetestParam;
            _config.BreakerEntryAtMid = BreakerEntryAtMidParam;
            _config.StopUseFOIEdge = StopUseFOIEdgeParam;
            _config.EnableReEntry = EnableReEntryParam;
            _config.ReEntryMax = ReEntryMaxParam;
            _config.ReEntryWithinBars = ReEntryWithinBarsParam;
            _config.ReEntryCooldownBars = ReEntryCooldownBarsParam;
            _config.UseWeeklyProfileBias = false;
            _config.EnableWeeklySwingMode = false;
            _config.RequireWeeklySweep = false;
            _config.UseWeeklyLiquidityTP = false;
            _config.EnableWeeklyAccumulationBias = false;
            _config.WeeklyAccumShiftTimeFrame = TimeFrame.Minute5;
            _config.WeeklyAccumUseRangeTargets = false;
            _config.EnableNewsModeOnly = EnableNewsModeOnlyParam;
            _config.NewsTradeWindows = NewsTradeWindowsParam;
            _config.EnableScalpingProfile = false;

            if (_config.EnablePingPongMode)
            {
                _config.PoiPriorityOrder = "OB>FVG>OTE";
            }
            _config.MinSlPipsFloor = MinSlPipsFloorParam;
            _config.EnforceAtrSanity = EnforceAtrSanityParam;
            _config.AtrPeriod = AtrPeriodParam;
            _config.AtrSanityFactor = AtrSanityFactorParam;
            _config.EnableTpSpreadCushion = EnableTpSpreadCushionParam;
            _config.SpreadCushionExtraPips = SpreadCushionExtraPipsParam;
            _config.SpreadCushionUseAvg = SpreadCushionUseAvgParam;
            _config.SpreadAvgPeriod = SpreadAvgPeriodParam;
            _config.ShowBoxLabels = ShowBoxLabelsParam;
            _config.MaxConcurrentPositions = Math.Max(1, MaxConcurrentPositionsParam);
            _config.CooldownBarsAfterEntry = Math.Max(0, CooldownBarsAfterEntryParam);

            // Apply scalping profile overrides (video: scalping 5M)
            if (_config.EnableScalpingProfile)
            {
                _config.TapTolerancePips = Math.Min(_config.TapTolerancePips, 0.5);
                _config.MinSlPipsFloor = Math.Min(_config.MinSlPipsFloor, 3.0);
                _config.PullbackMinPips = Math.Min(_config.PullbackMinPips, 0.3);
                _config.MssMaxAgeBars = Math.Min(Math.Max(4, _config.MssMaxAgeBars), 12);
                _config.SequenceLookbackBars = Math.Min(_config.SequenceLookbackBars, 40);
            }

            // Apply Phase4o4 strict mode overrides: trade only Sweep -> MSS -> OTE pattern
            if (Phase4o4StrictMode)
            {
                _config.RequireMSSForEntry = true;
                _config.RequireMSSandOTE = true;
                _config.StrictOteAfterMssCompletion = true;
                _config.RequireOteAlways = true;
                _config.RequireOteIfAvailable = true;
                _config.EnableSequenceGate = true;
                _config.AllowSequenceGateFallback = false;
                _config.RequireOppositeSweep = true;
                _config.RequireRetestToFOI = true;
                _config.EnableKillzoneGate = true;
                _config.PoiPriorityOrder = "OTE";
                _config.EnableContinuationReanchorOTE = false;
                _config.UseTimeframeAlignment = true;
                // legacy CT toggles removed
                _config.IncludePrevDayLevelsAsZones = true;
                _config.RequirePdhPdlSweepOnly = true;
                // Enable current-day H/L (intraday videos) to allow PD + session sweeps
                _config.IncludeCurrentDayLevelsAsZones = true;
                // Disable other liquidity sources in strict mode
                _config.IncludeEqualHighsLowsAsZones = false;
                _config.IncludeWeeklyLevelsAsZones = false;
                _config.AllowEqhEqlSweeps = false;
                _config.AllowCdhCdlSweeps = false; // handled specially during killzone
                _config.AllowWeeklySweeps = false;
                // Disable optional confirms not in base videos
                _config.RequireTripleConfirmation = false;
                _config.EnableSMT = false;
                _config.EnablePingPongMode = false;
                _config.EnableNewsBlackout = false;
            }

            if (_config.EnableDebugLogging)
            {
                _journal.Debug($"Params: RequirePullback={_config.RequirePullbackAfterBreak}, PullbackMinPips={_config.PullbackMinPips}, RequireMicroBreak={_config.RequireMicroBreak}, BreakRef={_config.BreakReference}, BreakLookback={_config.BreakLookbackBars}");
                _journal.Debug($"POI: Priority={_config.PoiPriorityOrder}, RequireOteIfAvailable={_config.RequireOteIfAvailable}, RequireOteAlways={_config.RequireOteAlways}, DualTap={_config.RequireDualTap} {(_config.DualTapPair)} OverlapPips={_config.DualTapOverlapPips}");
                _journal.Debug($"SequenceGate={_config.EnableSequenceGate}, SweepMssOte={_config.EnableSweepMssOte}, ContinuationOTE={_config.EnableContinuationReanchorOTE}");
            }
            _config.DefaultLeverageAssumption = DefaultLeverageAssumptionParam;
            _config.EnableMarginCheck = EnableMarginCheckParam;
            _config.MarginUtilizationMax = MarginUtilizationMaxParam;
            _config.EnforceNotionalCap = EnforceNotionalCapParam;
            _config.NotionalCapMultiple = NotionalCapMultipleParam;
            _config.UseHtfOrderBlocks = UseHtfOrderBlocks;
            _config.HtfObTimeFrame = HtfObTfParam;
            _config.NestedObTimeFrame = NestedObTfParam;

            // Apply high-level profile overrides (after strict mode so profile wins)
            ApplyProfileOverrides();

            // Ensure multi-TF series are prepared (safe to call even if already present)
            EnsureBarsLoaded(_config.BiasTimeFrame);
            EnsureBarsLoaded(_config.BiasTimeFrame);
            EnsureBarsLoaded(_config.IntradayBiasTimeFrame);
            EnsureBarsLoaded(_config.WeeklyAccumShiftTimeFrame);


            Print("Jadecap Strategy Bot Started - Version 5.4.9 build 44110");
            Print($"[PARAM DEBUG] MinRiskReward = {MinRiskReward:F2} (Expected: 0.60)");

            // Boot draw to confirm HUD
            try
            {
                var bootBias = _marketData.GetCurrentBias();
                _drawer?.DrawBiasStatus(bootBias, _config.BiasTimeFrame);
                // Optional: draw previous day levels once
                _drawer?.DrawPDH_PDL(drawEq50: true);
            }
            catch (Exception ex)
            {
                Print("Boot draw failed: {0}", ex.Message);
            }

            // ══════════════════════════════════════════════════════════════════
            // Initialize Phased Strategy Components (Week 1 Enhancement)
            // ══════════════════════════════════════════════════════════════════
            try
            {
                _phasedPolicy = new PhasedPolicySimple(this);
                _sweepBuffer = new SweepBufferCalculator(this, _phasedPolicy, _journal);
                _oteTouchDetector = new OTETouchDetector(this, _phasedPolicy, _journal);
                _cascadeValidator = new CascadeValidator(this, _phasedPolicy, _journal);
                _phaseManager = new PhaseManager(this, _phasedPolicy, _journal, _oteTouchDetector, _cascadeValidator);

                Print("[PHASED STRATEGY] ✓ All components initialized successfully");
                Print($"[PHASED STRATEGY] OTE Zone: {_phasedPolicy.OTEFibMin():P1}-{_phasedPolicy.OTEFibMax():P1}");
                Print($"[PHASED STRATEGY] Phase 1 Risk: {_phasedPolicy.Phase1RiskPercent():P2}, Phase 3 Risk: {_phasedPolicy.Phase3RiskPercent():P2}");
                Print($"[PHASED STRATEGY] ATR Period: {_phasedPolicy.GetATRPeriod()}, Cascades: DailyBias (240m), IntradayExecution (60m)");

                // Wire sweep buffer into sweep detector
                if (_sweepDetector != null && _sweepBuffer != null)
                {
                    _sweepDetector.SetSweepBuffer(_sweepBuffer);
                    Print("[PHASED STRATEGY] ✓ ATR buffer wired into LiquiditySweepDetector");
                }
            }
            catch (Exception ex)
            {
                Print($"[PHASED STRATEGY] INITIALIZATION ERROR: {ex.Message}");
                Print($"[PHASED STRATEGY] Stack: {ex.StackTrace}");
            }

            // ══════════════════════════════════════════════════════════════════
            // Subscribe to position events for risk management tracking
            // ══════════════════════════════════════════════════════════════════
            Positions.Opened += OnPositionOpenedEvent;
            Positions.Closed += OnPositionClosed;

            // ══════════════════════════════════════════════════════════════════
            // OCT 30 ENHANCEMENT #5: CLEAR SIGNALBOX CACHE ON BOT START
            // ══════════════════════════════════════════════════════════════════
            // Clear any cached signals from previous sessions to prevent stale entries
            if (_state != null && _state.TouchedBoxes != null)
            {
                _state.TouchedBoxes.Clear();
                Print("[SIGNALBOX FIX] ✓ Cleared cached signals from previous session");
            }
            else
            {
                Print("[SIGNALBOX] No cached signals to clear (fresh start)");
            }

                // CRASH FIX: Mark initialization as complete
                _isInitialized = true;

                Print("[STARTUP] ========================================");
                Print("[STARTUP] ✅ Bot initialized successfully");
                Print($"[STARTUP] _isInitialized = {_isInitialized}, _timerStarted = {_timerStarted}");
                Print("[STARTUP] ========================================");
            }
            catch (Exception ex)
            {
                Print("[STARTUP ERROR] ========================================");
                Print($"[STARTUP ERROR] ❌ FATAL ERROR during initialization");
                Print($"[STARTUP ERROR] Exception Type: {ex.GetType().Name}");
                Print($"[STARTUP ERROR] Message: {ex.Message}");
                Print($"[STARTUP ERROR] Stack Trace:");
                Print($"[STARTUP ERROR] {ex.StackTrace}");
                if (ex.InnerException != null)
                {
                    Print($"[STARTUP ERROR] Inner Exception: {ex.InnerException.GetType().Name}");
                    Print($"[STARTUP ERROR] Inner Message: {ex.InnerException.Message}");
                }
                Print("[STARTUP ERROR] ========================================");
                throw; // Re-throw to stop the bot
            }
        }

        // NEW: Background method to update news analysis from Gemini API
        // FIX: Accept parameters instead of accessing cTrader properties from background thread
        private async System.Threading.Tasks.Task UpdateNewsAnalysis(string asset, DateTime utcTime, BiasDirection currentBias)
        {
            try
            {
                int lookaheadMinutes = 240; // 4 hours lookahead

                // DEBUG: Log API call attempt
                BeginInvokeOnMainThread(() => Print($"[GEMINI API DEBUG] ========== API CALL ATTEMPT =========="));
                BeginInvokeOnMainThread(() => Print($"[GEMINI API DEBUG] Timestamp: {utcTime:yyyy-MM-dd HH:mm:ss} UTC"));
                BeginInvokeOnMainThread(() => Print($"[GEMINI API DEBUG] Asset: {asset}"));
                BeginInvokeOnMainThread(() => Print($"[GEMINI API DEBUG] Current Bias: {currentBias}"));
                BeginInvokeOnMainThread(() => Print($"[GEMINI API DEBUG] Lookahead: {lookaheadMinutes} minutes"));
                BeginInvokeOnMainThread(() => Print($"[GEMINI API DEBUG] Calling _smartNews.GetGeminiAnalysis()..."));

                // Call the Gemini API (async, non-blocking)
                NewsContextAnalysis analysis = await _smartNews.GetGeminiAnalysis(
                    asset,
                    utcTime,
                    currentBias,
                    lookaheadMinutes
                );

                // DEBUG: Log response received
                BeginInvokeOnMainThread(() => Print($"[GEMINI API DEBUG] Response received from API"));
                BeginInvokeOnMainThread(() => Print($"[GEMINI API DEBUG] Context: {analysis.Context}"));
                BeginInvokeOnMainThread(() => Print($"[GEMINI API DEBUG] Reaction: {analysis.Reaction}"));

                // Thread-safe update of shared state
                lock (_analysisLock)
                {
                    _currentNewsContext = analysis;
                }
                BeginInvokeOnMainThread(() => Print($"[GEMINI API DEBUG] _currentNewsContext updated (thread-safe)"));

                // Log the result
                if (analysis.BlockNewEntries)
                {
                    BeginInvokeOnMainThread(() => Print($"[GEMINI API] ⚠️ Entry BLOCKED: {analysis.Reasoning}"));
                }
                else
                {
                    BeginInvokeOnMainThread(() => Print($"[GEMINI API] ✅ News analysis updated: {analysis.Reasoning}"));
                    BeginInvokeOnMainThread(() => Print($"[GEMINI API] BlockNewEntries={analysis.BlockNewEntries}, RiskMult={analysis.RiskMultiplier:F2}, ConfAdj={analysis.ConfidenceAdjustment:F2}"));
                }

                BeginInvokeOnMainThread(() => Print($"[GEMINI API DEBUG] ========== API CALL COMPLETE =========="));
            }
            catch (Exception ex)
            {
                BeginInvokeOnMainThread(() => Print($"[GEMINI API] ❌ ERROR updating news analysis: {ex.Message}"));
                BeginInvokeOnMainThread(() => Print($"[GEMINI API DEBUG] Stack trace: {ex.StackTrace}"));
            }
        }

        protected override void OnTimer()
        {
            try
            {
                var effectivePath = GetEffectiveConfigPath();
                var ts = System.IO.File.GetLastWriteTime(effectivePath);
                if (ts > _lastCfgWrite) ReloadConfigSafe();
            }
            catch { /* ignore IO errors */ }
        }

        protected override void OnBar()
        {
            NormalizeSessionsToServerUtc();

            ApplyUnifiedPolicies();

            try
            {
                // ══════════════════════════════════════════════════════════════════
                // RISK MANAGEMENT GATES - Check BEFORE any trading logic
                // ══════════════════════════════════════════════════════════════════

                // 1. Check risk management gates (circuit breaker, daily limits, cooldown)
                bool riskGatesPass = CheckRiskManagementGates();

                // 2. Manage time-in-trade for existing positions
                ManageTimeInTrade();

                // 3. Draw performance HUD (if debug enabled)
                DrawPerformanceHUD();

                // 4. If risk gates block trading, skip signal generation but continue chart updates
                if (!riskGatesPass)
                {
                    // Still manage open positions even if new entries are blocked
                    _tradeManager?.ManageOpenPositions(Symbol);
                    return; // Skip signal generation
                }

                // ═══════════════════════════════════════════════════════════════════
                // PHASE 2: MARKET REGIME DETECTION
                // ═══════════════════════════════════════════════════════════════════
                if (_adx != null && _atr != null)
                {
                    double adxValue = _adx.ADX.LastValue;
                    double atrValue = _atr.Result.LastValue;
                    // Calculate simple 20-period average of ATR for volatility spike detection
                    double atrSum = 0;
                    int atrPeriod = Math.Min(20, _atr.Result.Count);
                    for (int i = 0; i < atrPeriod; i++)
                        atrSum += _atr.Result.Last(i);
                    double atrMA = atrSum / atrPeriod;

                    // Determine regime based on ADX and ATR
                    MarketRegime previousRegime = _currentRegime;

                    if (adxValue > 25)
                        _currentRegime = MarketRegime.Trending;
                    else if (adxValue < 20)
                        _currentRegime = MarketRegime.Ranging;
                    else
                        _currentRegime = MarketRegime.Ranging; // Default

                    // Override with volatility check
                    if (atrValue > atrMA * 1.5)
                        _currentRegime = MarketRegime.Volatile;
                    else if (atrValue < atrMA * 0.5)
                        _currentRegime = MarketRegime.Quiet;

                    if (_currentRegime != previousRegime && _config.EnableDebugLogging)
                        _journal.Debug($"[REGIME CHANGE] {previousRegime} → {_currentRegime} | ADX={adxValue:F1}, ATR={atrValue:F5}");
                }

                // ═══════════════════════════════════════════════════════════════════
                // HTF BIAS/SWEEP STATE MACHINE UPDATE
                // ═══════════════════════════════════════════════════════════════════
                if (_htfSystemEnabled && _biasStateMachine != null)
                {
                    // CRITICAL FIX (Oct 25): Check for daily boundary and reset bias
                    // Power of Three resets at Asia session start (00:00 UTC)
                    var utcNow = Server.Time.ToUniversalTime();
                    var utcHour = utcNow.Hour;
                    var utcMinute = utcNow.Minute;

                    // Reset at Asia session start (00:00-00:05 UTC window)
                    if (utcHour == 0 && utcMinute < 5)
                    {
                        // Check if we haven't reset today yet
                        if (_state.LastDailyResetDate != utcNow.Date)
                        {
                            _biasStateMachine.DailyReset();
                            _state.LastDailyResetDate = utcNow.Date;
                            _state.LastHTFBias = null; // Clear persisted bias for new day
                            if (_config.EnableDebugLogging)
                                Print($"[HTF DAILY RESET] New trading day at {utcNow:yyyy-MM-dd HH:mm} UTC - bias cleared");
                        }
                    }

                    _biasStateMachine.OnBar();
                }

                // ═══════════════════════════════════════════════════════════════════
                // ADVANCED FEATURE: MULTI-TIMEFRAME BIAS INTEGRATION
                // ═══════════════════════════════════════════════════════════════════
                if (_mtfBias != null)
                {
                    // Update Daily context once per day (at Asia session start)
                    var utcNow = Server.Time.ToUniversalTime();
                    if (utcNow.Hour == 0 && utcNow.Minute < 5)
                    {
                        _mtfBias.UpdateDailyContext();
                    }

                    // Update Intraday context every bar
                    // Use _currentMssSignals (populated later in signal detection) or create list from ActiveMSS
                    List<MSSSignal> recentMSSSignals = _currentMssSignals ??
                        (_state.ActiveMSS != null ? new List<MSSSignal> { _state.ActiveMSS } : new List<MSSSignal>());
                    LiquiditySweep lastSweep = _state.ActiveSweep;
                    _mtfBias.UpdateIntradayContext(recentMSSSignals, lastSweep);

                    // Calculate confluence score
                    double currentPrice = Symbol.Bid;
                    _currentBiasConfluence = _mtfBias.CalculateConfluence(currentPrice);

                    // Log narrative if debug enabled
                    if (_config.EnableDebugLogging && _currentBiasConfluence != null)
                    {
                        _journal.Debug($"[MTF BIAS] {_currentBiasConfluence.Narrative}");
                        _journal.Debug($"[MTF BIAS] Confluence Score: {_currentBiasConfluence.Score} | Strength: {_currentBiasConfluence.Strength} | Direction: {_currentBiasConfluence.Direction}");
                    }
                }

                // ═══════════════════════════════════════════════════════════════════
                // ADVANCED FEATURE: SMART NEWS ANALYSIS
                // ═══════════════════════════════════════════════════════════════════
                if (_smartNews != null)
                {
                    // Get current bias direction from HTF system or fallback
                    BiasDirection currentBias = BiasDirection.Neutral;
                    if (_htfSystemEnabled && _biasStateMachine != null)
                    {
                        BiasDirection? confirmedBias = _biasStateMachine.GetConfirmedBias();
                        currentBias = confirmedBias ?? BiasDirection.Neutral;
                    }
                    else if (_currentBiasConfluence != null)
                    {
                        currentBias = _currentBiasConfluence.Direction;
                    }

                    // Analyze news context
                    _currentNewsContext = _smartNews.AnalyzeNewsContext(currentBias, Server.Time);

                    // Log analysis if debug enabled
                    if (_config.EnableDebugLogging && _currentNewsContext != null)
                    {
                        _journal.Debug($"[SMART NEWS] Context: {_currentNewsContext.Context} | Reaction: {_currentNewsContext.Reaction}");
                        _journal.Debug($"[SMART NEWS] {_currentNewsContext.Reasoning}");
                        _journal.Debug($"[SMART NEWS] Adjustments: Confidence {_currentNewsContext.ConfidenceAdjustment:+0.0;-0.0} | Risk {_currentNewsContext.RiskMultiplier:F2}× | Block: {_currentNewsContext.BlockNewEntries} | Invalidate: {_currentNewsContext.InvalidateBias}");
                    }

                    // CRITICAL: If news invalidates bias, reset bias state machine
                    if (_currentNewsContext.InvalidateBias && _htfSystemEnabled && _biasStateMachine != null)
                    {
                        if (_config.EnableDebugLogging)
                            Print($"[SMART NEWS] ⚠️ POST-NEWS INVALIDATION: Resetting bias state machine due to contradictory volatility");

                        _biasStateMachine.Reset();
                        _state.ActiveMSS = null;
                        _state.OppositeLiquidityLevel = 0;
                    }

                    // If blocking new entries, skip signal generation
                    if (_currentNewsContext.BlockNewEntries)
                    {
                        if (_config.EnableDebugLogging)
                            _journal.Debug($"[SMART NEWS] 🚫 BLOCKING NEW ENTRIES: {_currentNewsContext.Reasoning}");

                        // Still manage existing positions
                        _tradeManager?.ManageOpenPositions(Symbol);
                        return;  // Skip signal generation
                    }
                }

                // ══════════════════════════════════════════════════════════════════

                var confirmedZones = new List<string>();
                var tagsIdx = new Dictionary<string,int>();

                // 1) Data & bias
                _marketData.UpdateData();

                // Use HTF state machine bias if enabled, otherwise fallback to old system
                BiasDirection bias;
                if (_htfSystemEnabled && _biasStateMachine != null)
                {
                    // Use confirmed bias from state machine, maintain last bias if null
                    var htfBias = _biasStateMachine.GetConfirmedBias();
                    if (htfBias.HasValue)
                    {
                        _state.LastHTFBias = htfBias.Value; // Store for persistence
                        bias = htfBias.Value;
                    }
                    else
                    {
                        // CRITICAL FIX (Oct 25): Maintain last known HTF bias instead of defaulting to Neutral
                        // HTF Power of Three: bias persists throughout trading day once established
                        bias = _state.LastHTFBias ?? _marketData.GetCurrentBias();
                    }

                    if (_config.EnableDebugLogging && Bars.Count % 20 == 0)
                        Print($"[HTF BIAS] Using state machine bias: {bias} (state={_biasStateMachine.GetState()}, confidence={_biasStateMachine.GetConfidence()}, lastHTF={_state.LastHTFBias})");
                }
                else
                {
                    // Fallback to old system
                    bias = _marketData.GetCurrentBias();
                }

                // 2) Update zones
                _marketData.UpdateLiquidityZones();

                // 3) Sweeps
                var sweeps = _sweepDetector?.DetectSweeps(Server.Time, Bars, _marketData.GetLiquidityZones()) ?? new List<LiquiditySweep>();

                // PHASE 1A: RECORD SWEEP DATA FOR ADAPTIVE LEARNING
                // PHASE 1B: FILTER LOW-RELIABILITY SWEEPS USING ADAPTIVE SCORING
                if (_learningEngine != null && _config.EnableAdaptiveLearning && sweeps != null && sweeps.Count > 0)
                {
                    var originalSweepCount = sweeps.Count;
                    var filteredSweeps = new List<LiquiditySweep>();

                    foreach (var sweep in sweeps)
                    {
                        // Record each sweep for reliability learning
                        double excessPips = 0; // Calculate excess beyond level if needed
                        _learningEngine.RecordLiquiditySweep(sweep.Label ?? "Unknown", sweep.Price, excessPips);

                        // PHASE 1B: Apply adaptive scoring filter
                        if (_config.UseAdaptiveScoring)
                        {
                            double sweepReliability = _learningEngine.CalculateSweepReliability(sweep.Label ?? "Unknown", excessPips);
                            if (sweepReliability < _config.AdaptiveConfidenceThreshold)
                            {
                                if (EnableDebugLoggingParam)
                                    _journal.Debug($"[ADAPTIVE FILTER] Sweep rejected: {sweep.Label} | Reliability {sweepReliability:F2} < {_config.AdaptiveConfidenceThreshold:F2}");
                                continue; // Skip this sweep
                            }
                            if (EnableDebugLoggingParam)
                                _journal.Debug($"[ADAPTIVE FILTER] Sweep passed: {sweep.Label} | Reliability {sweepReliability:F2}");
                        }

                        filteredSweeps.Add(sweep);
                    }

                    if (_config.UseAdaptiveScoring && originalSweepCount != filteredSweeps.Count && EnableDebugLoggingParam)
                        _journal.Debug($"[ADAPTIVE FILTER] Sweeps filtered: {originalSweepCount} → {filteredSweeps.Count} (removed {originalSweepCount - filteredSweeps.Count} low-reliability sweeps)");

                    sweeps = filteredSweeps; // Use filtered sweeps for rest of strategy
                }

                // Wire CascadeValidator: Register sweeps with cascade validator
                if (_cascadeValidator != null && sweeps != null && sweeps.Count > 0)
                {
                    foreach (var sweep in sweeps)
                    {
                        // Determine which cascade this sweep belongs to based on timeframe
                        string cascadeName = (Chart.TimeFrame == TimeFrame.Daily || Chart.TimeFrame == TimeFrame.Hour)
                            ? "DailyBias"
                            : "IntradayExecution";

                        TradeType sweepDir = sweep.IsBullish ? TradeType.Buy : TradeType.Sell;
                        _cascadeValidator.RegisterHTFSweep(cascadeName, sweep.Price, sweepDir);
                    }
                }

                // Accept only allowed sweep labels; optional double-sweep skip in killzone
                var _sessOff = TimeSpan.FromHours(GetSessionOffsetHours(Server.Time));
                var sessionNow = Server.Time + _sessOff;

                // Use preset-based killzone if orchestrator is configured with presets
                bool inKillzone;
                if (_orc != null && _orc.UseMultiPresetMode && _orc.GetActivePresetCount() > 0)
                {
                    var utcNow = Server.Time.ToUniversalTime();
                    inKillzone = _orc.IsInKillzone(utcNow);

                    if (_config.EnableDebugLogging && Bars.Count % 50 == 0)
                    {
                        var kzInfo = _orc.GetKillzoneInfo();
                        _journal.Debug($"Preset KZ: {utcNow:HH:mm} UTC | inKZ={inKillzone} | Active={_orc.GetActivePresetNames()} | KZ={kzInfo.start:hh\\:mm}-{kzInfo.end:hh\\:mm}");
                    }
                }
                else
                {
                    // Fallback to legacy killzone settings
                    inKillzone = IsWithinKillZone(sessionNow.TimeOfDay, _config.KillZoneStart, _config.KillZoneEnd);

                    if (_config.EnableDebugLogging && Bars.Count % 50 == 0)
                    {
                        _journal.Debug($"Legacy KZ: {sessionNow.TimeOfDay:hh\\:mm} | inKZ={inKillzone} | KZ={_config.KillZoneStart:hh\\:mm}-{_config.KillZoneEnd:hh\\:mm}");
                    }
                }
                if (sweeps != null && sweeps.Count > 0)
                {
                    var accepted = new List<LiquiditySweep>();
                    foreach (var s in sweeps)
                        if (AcceptSweepLabel(s.Label)) accepted.Add(s);
                    sweeps = accepted;
                    if (_config.SkipDoubleSweepInKillzone && inKillzone && sweeps.Count >= 2)
                    {
                        var last = sweeps[sweeps.Count - 1];
                        var prev = sweeps[sweeps.Count - 2];
                        if ((last.IsBullish && !prev.IsBullish) || (!last.IsBullish && prev.IsBullish))
                        {
                            sweeps.Clear();
                        }
                    }
                }
                // update spread samples
                try
                {
                    double pip = Symbol.PipSize;
                    double sp = (pip > 0) ? (Symbol.Spread / pip) : 0;
                    _state.SpreadPips.Enqueue(sp);
                    while (_state.SpreadPips.Count > Math.Max(1, _config.SpreadAvgPeriod)) _state.SpreadPips.Dequeue();
                }
                catch { }

                // CRITICAL FIX (Oct 25): Display proper ICT bias status
                BiasDirection activeBias = bias; // Use the HTF bias we determined earlier
                TimeFrame entryPoiTf = Chart.TimeFrame;

                // Display detailed bias status for user
                if (_htfSystemEnabled && _biasStateMachine != null)
                {
                    var biasState = _biasStateMachine.GetState();
                    var biasConfidence = _biasStateMachine.GetConfidence();

                    // Show bias status on chart HUD
                    string biasStatus = $"Bias: {bias} | State: {biasState} | Confidence: {biasConfidence}";

                    // Add more detail based on state
                    switch (biasState)
                    {
                        case BiasState.HTF_BIAS_SET:
                            biasStatus += " | HTF Bias Confirmed";
                            break;
                        case BiasState.AWAITING_SWEEP:
                            biasStatus += $" | Waiting for {(bias == BiasDirection.Bullish ? "DOWN" : "UP")} sweep";
                            break;
                        case BiasState.SWEEP_DETECTED:
                            biasStatus += " | Sweep detected, waiting for MSS";
                            break;
                        case BiasState.MSS_CONFIRMED:
                            biasStatus += " | MSS confirmed with displacement";
                            break;
                        case BiasState.READY_FOR_ENTRY:
                            biasStatus += " | ✅ Ready for OTE entries";
                            break;
                    }

                    // Update HUD with bias status
                    if (_drawer != null)
                    {
                        _drawer.DrawBiasStatus(bias, _config.BiasTimeFrame);
                        // BiasStatus is now integrated into consolidated HUD below - removed duplicate
                    }

                    if (_config.EnableDebugLogging && Bars.Count % 20 == 0)
                        Print($"[ICT STATUS] {biasStatus}");
                }

                // INTELLIGENT BIAS DASHBOARD UPDATE (Oct 25)
                if (_useIntelligentBias && _biasDashboard != null)
                {
                    try
                    {
                        // Update dashboard every bar
                        _biasDashboard.UpdateDashboard();

                        // Get intelligent bias for current chart
                        var intelligentAnalysis = _intelligentAnalyzer.GetIntelligentBias(Chart.TimeFrame);

                        // Override bias if intelligent system has strong signal
                        if (intelligentAnalysis.Strength >= 70 && intelligentAnalysis.Bias != BiasDirection.Neutral)
                        {
                            bias = intelligentAnalysis.Bias;
                            activeBias = bias;

                            // Wire PhaseManager: Set bias ONLY when it changes (not every bar)
                            if (_phaseManager != null && bias != _lastSetPhaseBias)
                            {
                                _phaseManager.SetBias(bias, $"IntelligentBias-{intelligentAnalysis.Strength}%");
                                _lastSetPhaseBias = bias; // Track to prevent repeated calls

                                if (_config.EnableDebugLogging)
                                {
                                    Print($"[INTELLIGENT BIAS] NEW Bias set: {bias} ({intelligentAnalysis.Strength}%)");
                                    Print($"[INTELLIGENT BIAS] Reason: {intelligentAnalysis.Reason}");
                                    Print($"[INTELLIGENT BIAS] Phase: {intelligentAnalysis.Phase}");
                                }
                            }
                            else if (_config.EnableDebugLogging && Bars.Count % 20 == 0)
                            {
                                Print($"[INTELLIGENT BIAS] Continuing: {bias} ({intelligentAnalysis.Strength}%)");
                            }
                        }

                        // Display multi-TF consensus
                        if (Bars.Count % 50 == 0)
                        {
                            var consensus = _biasDashboard.GetMultiTimeframeConsensus();
                            Print($"[INTELLIGENT BIAS] {consensus}");
                        }
                    }
                    catch (Exception ex)
                    {
                        if (_config.EnableDebugLogging)
                            Print($"[INTELLIGENT BIAS] Dashboard error: {ex.Message}");
                    }
                }

                // —— MSS (CT module) side flags ——
                bool htfBiasIsBullish = (bias == BiasDirection.Bullish);
                // inKillzone computed above
                bool hadSweepFlag = sweeps != null && sweeps.Any();

                if (_config.RequireOppositeSweep && sweeps != null)
                {
                    int look = Math.Max(1, _config.OppositeSweepLookback);
                    int iBar = Bars.Count - 1;
                    if (iBar > 0)
                    {
                        double recentLow = double.MaxValue;
                        double recentHigh = double.MinValue;
                        int from = Math.Max(1, iBar - look);
                        for (int k = from; k < iBar; k++)
                        {
                            recentLow = Math.Min(recentLow, Bars.LowPrices[k]);
                            recentHigh = Math.Max(recentHigh, Bars.HighPrices[k]);
                        }
                        bool sweptSell = Bars.LowPrices[iBar - 1] < recentLow;
                        bool sweptBuy = Bars.HighPrices[iBar - 1] > recentHigh;
                        if (!(sweptSell || sweptBuy)) hadSweepFlag = false;
                    }
                    // Scope to accepted liquidity sources
                    hadSweepFlag = sweeps.Any(s => AcceptSweepLabel(s.Label));
                }

                // Skip legacy CT-MSS module and CT bias; rely on native detectors only

                // 5) Native MSS - Using LOWER TIMEFRAME bars for MSS detection (Multi-TF Cascade)
                var mssBars = _state.MSSBars ?? Bars; // Use lower TF bars for MSS, fallback to chart bars if unavailable
                var mssSignals = _mssDetector.DetectMSS(mssBars, sweeps);

                // PHASE 1A: RECORD MSS DATA FOR ADAPTIVE LEARNING
                if (_learningEngine != null && _config.EnableAdaptiveLearning && mssSignals != null && mssSignals.Count > 0)
                {
                    foreach (var mss in mssSignals)
                    {
                        // Calculate displacement metrics
                        double displacementPips = Math.Abs(mss.ImpulseEnd - mss.ImpulseStart) / Symbol.PipSize;
                        double displacementATR = displacementPips / 10.0; // Rough ATR approximation (10 pips = 1 ATR for M5 EURUSD)
                        bool bodyClose = true; // Assume body close (can be refined)

                        _learningEngine.RecordMssDetection(
                            mss.Direction == BiasDirection.Bullish ? "Bullish" : "Bearish",
                            mss.Price,
                            displacementPips,
                            displacementATR,
                            bodyClose
                        );
                    }
                }

                if (EnableDebugLoggingParam && Bars.Count % 10 == 0) // Print every 10 bars to avoid spam
                {
                    Print($"[DEBUG] MSS: {mssSignals.Count} signals detected");
                    foreach (var mss in mssSignals)
                        Print($"  MSS → {mss.Type} | Break@{mss.BreakLevel:F5} | BreakIdx={mss.BreakIndex} | Valid={mss.ValidUntilIndex}");
                }

                // 5a) MSS LIFECYCLE MANAGEMENT (first MSS after sweep - locked until entry or opposite liquidity touched)
                // Lock first valid MSS after sweep, ignore subsequent MSS until entry or opposite liquidity touched
                if (mssSignals != null && mssSignals.Count > 0 && sweeps != null && sweeps.Count > 0)
                {
                    var latestSweep = sweeps.LastOrDefault(s => AcceptSweepLabel(s.Label));

                    // CRITICAL FIX (Oct 25): Clear stale MSS if too old (>400 bars = ~33 hours on M5)
                    if (_state.ActiveMSS != null)
                    {
                        int mssBarIdx = FindBarIndexByTime(_state.ActiveMSS.Time);
                        if (mssBarIdx >= 0)
                        {
                            int barsAgo = Bars.Count - 1 - mssBarIdx;
                            if (barsAgo > 400) // MSS too old, clear it
                            {
                                if (EnableDebugLoggingParam)
                                    _journal.Debug($"MSS Lifecycle: STALE MSS CLEARED → {_state.ActiveMSS.Direction} MSS from {_state.ActiveMSS.Time:HH:mm} is {barsAgo} bars old (>400 limit)");
                                _state.ActiveMSS = null;
                                _state.ActiveMSSTime = DateTime.MinValue;
                                _state.OppositeLiquidityLevel = 0;
                                _state.ActiveSweep = null; // Allow new sweep detection
                                _state.MSSEntryOccurred = false;
                                _state.OppositeLiquidityTouched = false;
                                _state.ActiveOTE = null;
                                _state.ActiveOTETime = DateTime.MinValue;
                            }
                        }
                    }

                    // Check if opposite liquidity has been touched (price reached TP target)
                    if (_state.ActiveMSS != null && _state.OppositeLiquidityLevel > 0 && !_state.OppositeLiquidityTouched)
                    {
                        double currentClose = Bars.ClosePrices.LastValue;
                        if (_state.ActiveMSS.Direction == BiasDirection.Bullish)
                        {
                            // Bullish MSS: opposite liquidity is ABOVE → SUCCESS if price reaches it
                            // Check if price has reached or exceeded the target above
                            if (currentClose >= _state.OppositeLiquidityLevel)
                            {
                                _state.OppositeLiquidityTouched = true;
                                if (EnableDebugLoggingParam)
                                    _journal.Debug($"MSS Lifecycle: OPPOSITE LIQUIDITY REACHED → Bullish target hit! (close={currentClose:F5} >= oppLiq={_state.OppositeLiquidityLevel:F5}) | TP target reached");
                            }
                        }
                        else if (_state.ActiveMSS.Direction == BiasDirection.Bearish)
                        {
                            // Bearish MSS: opposite liquidity is BELOW → SUCCESS if price reaches it
                            // Check if price has reached or gone below the target below
                            if (currentClose <= _state.OppositeLiquidityLevel)
                            {
                                _state.OppositeLiquidityTouched = true;
                                if (EnableDebugLoggingParam)
                                    _journal.Debug($"MSS Lifecycle: OPPOSITE LIQUIDITY REACHED → Bearish target hit! (close={currentClose:F5} <= oppLiq={_state.OppositeLiquidityLevel:F5}) | TP target reached");
                            }
                        }
                    }

                    // Reset lifecycle if entry occurred or opposite liquidity touched
                    if (_state.MSSEntryOccurred || _state.OppositeLiquidityTouched)
                    {
                        if (EnableDebugLoggingParam)
                            _journal.Debug($"MSS Lifecycle: Reset (Entry={_state.MSSEntryOccurred}, OppLiq={_state.OppositeLiquidityTouched}) | Keep ActiveSweep to prevent re-locking from same sweep");
                        _state.ActiveMSS = null;
                        _state.ActiveMSSTime = DateTime.MinValue;
                        // KEEP ActiveSweep - don't reset it! We need to remember which sweep we used
                        // Only reset when a NEW sweep occurs
                        // _state.ActiveSweep = null;  // COMMENTED OUT
                        _state.MSSEntryOccurred = false;
                        _state.OppositeLiquidityTouched = false;
                        _state.OppositeLiquidityLevel = 0;

                        // Reset OTE lifecycle as well
                        _state.ActiveOTE = null;
                        _state.ActiveOTETime = DateTime.MinValue;
                    }

                    // Lock first MSS after sweep if no active MSS AND we have a NEW sweep (not the old one)
                    // Check if latestSweep is different from the sweep we already used
                    bool isNewSweep = latestSweep != null && (_state.ActiveSweep == null || latestSweep.Time != _state.ActiveSweep.Time);

                    if (EnableDebugLoggingParam && latestSweep != null && !isNewSweep && _state.ActiveMSS == null)
                        _journal.Debug($"MSS Lifecycle: Ignoring same sweep at {latestSweep.Time:HH:mm} (already used) | Waiting for NEW sweep");

                    if (_state.ActiveMSS == null && isNewSweep)
                    {
                        // Find first valid MSS after this NEW sweep
                        foreach (var mss in mssSignals)
                        {
                            if (mss.IsValid && mss.Time > latestSweep.Time)
                            {
                                // PHASE 1B: ADAPTIVE SCORING FILTER FOR MSS
                                if (_learningEngine != null && _config.EnableAdaptiveLearning && _config.UseAdaptiveScoring)
                                {
                                    double displacementPips = Math.Abs(mss.ImpulseEnd - mss.ImpulseStart) / Symbol.PipSize;
                                    double displacementATR = displacementPips / 10.0; // Rough ATR approximation
                                    bool bodyClose = true; // Assume body close for now
                                    double mssQuality = _learningEngine.CalculateMssQuality(displacementATR, bodyClose);

                                    if (mssQuality < _config.AdaptiveConfidenceThreshold)
                                    {
                                        if (EnableDebugLoggingParam)
                                            _journal.Debug($"[ADAPTIVE FILTER] MSS rejected: Quality {mssQuality:F2} < {_config.AdaptiveConfidenceThreshold:F2} | Displacement={displacementPips:F1}pips");
                                        continue; // Skip this MSS - low quality
                                    }

                                    if (EnableDebugLoggingParam)
                                        _journal.Debug($"[ADAPTIVE FILTER] MSS passed: Quality {mssQuality:F2} >= {_config.AdaptiveConfidenceThreshold:F2}");
                                }

                                // ADVANCED FEATURE: PRICE ACTION QUALITY GATE - Analyze MSS break quality
                                if (_priceActionAnalyzer != null)
                                {
                                    _currentMSSQuality = _priceActionAnalyzer.AnalyzeMSSBreak(mss, 5);

                                    if (_config.EnableDebugLogging)
                                    {
                                        _journal.Debug($"[PRICE ACTION] MSS Quality: {_currentMSSQuality.Quality} | Momentum: {_currentMSSQuality.Momentum}");
                                        _journal.Debug($"[PRICE ACTION] {_currentMSSQuality.Reasoning}");
                                        _journal.Debug($"[PRICE ACTION] Strength Score: {_currentMSSQuality.StrengthScore:F2}/1.0");
                                    }

                                    // Filter out very weak MSS breaks (optional - can be disabled if too restrictive)
                                    if (_currentMSSQuality.Quality == PriceActionAnalyzer.MoveQuality.WeakCorrective &&
                                        _currentMSSQuality.StrengthScore < 0.3)
                                    {
                                        if (EnableDebugLoggingParam)
                                            _journal.Debug($"[PRICE ACTION GATE] MSS rejected: Very weak break (Score={_currentMSSQuality.StrengthScore:F2})");
                                        continue; // Skip this MSS - poor quality break
                                    }
                                }

                                _state.ActiveMSS = mss;
                                _state.ActiveMSSTime = mss.Time;
                                _state.ActiveSweep = latestSweep;
                                _state.MSSEntryOccurred = false;
                                _state.OppositeLiquidityTouched = false;

                                // Wire CascadeValidator: Register MSS with cascade validator
                                if (_cascadeValidator != null)
                                {
                                    string cascadeName = (Chart.TimeFrame == TimeFrame.Daily || Chart.TimeFrame == TimeFrame.Hour)
                                        ? "DailyBias"
                                        : "IntradayExecution";
                                    TradeType mssDir = (mss.Direction == BiasDirection.Bullish) ? TradeType.Buy : TradeType.Sell;
                                    _cascadeValidator.RegisterLTF_MSS(cascadeName, mssDir);
                                }

                                // Wire PhaseManager: Set bias from MSS if IntelligentBias not strong enough
                                if (_phaseManager != null && mss.Direction != _lastSetPhaseBias)
                                {
                                    _phaseManager.SetBias(mss.Direction, "MSS-Fallback");
                                    _lastSetPhaseBias = mss.Direction;

                                    if (_config.EnableDebugLogging)
                                        _journal.Debug($"[MSS BIAS] Fallback bias set: {mss.Direction} (IntelligentBias < 70% or inactive)");
                                }

                                // Set opposite liquidity level based on MSS direction
                                var liquidity = _marketData.GetLiquidityZones();
                                if (mss.Direction == BiasDirection.Bullish)
                                {
                                    // Bullish MSS: We're going LONG → Target is buy-side liquidity ABOVE (Supply/EQH)
                                    // Find nearest Supply zone above current price
                                    var buySideLiquidity = liquidity?.Where(z => z.Type == LiquidityZoneType.Supply && z.High > Bars.ClosePrices.LastValue)
                                                                      .OrderBy(z => z.High)
                                                                      .FirstOrDefault();
                                    _state.OppositeLiquidityLevel = buySideLiquidity?.High ?? 0;
                                }
                                else
                                {
                                    // Bearish MSS: We're going SHORT → Target is sell-side liquidity BELOW (Demand/EQL)
                                    // Find nearest Demand zone below current price
                                    var sellSideLiquidity = liquidity?.Where(z => z.Type == LiquidityZoneType.Demand && z.Low < Bars.ClosePrices.LastValue)
                                                                      .OrderByDescending(z => z.Low)
                                                                      .FirstOrDefault();
                                    _state.OppositeLiquidityLevel = sellSideLiquidity?.Low ?? 0;
                                }

                                if (EnableDebugLoggingParam)
                                    _journal.Debug($"MSS Lifecycle: LOCKED → {mss.Direction} MSS at {mss.Time:HH:mm} | OppLiq={_state.OppositeLiquidityLevel:F5}");
                                break;
                            }
                        }
                    }

                    // If ActiveMSS is locked, filter mssSignals to only include the active MSS
                    if (_state.ActiveMSS != null)
                    {
                        mssSignals = new List<MSSSignal> { _state.ActiveMSS };
                        if (EnableDebugLoggingParam && Bars.Count % 10 == 0)
                            _journal.Debug($"MSS Lifecycle: Using locked MSS (ignoring new MSS) | ActiveMSS={_state.ActiveMSS.Direction} at {_state.ActiveMSSTime:HH:mm}");
                    }
                }

                // 6) OTE Lifecycle: Lock OTE to active MSS (don't redraw until new sweep+MSS)
                List<OTEZone> oteZones;

                if (_state.ActiveOTE != null)
                {
                    // Use locked OTE zone (don't detect new ones while MSS is active)
                    oteZones = new List<OTEZone> { _state.ActiveOTE };
                    if (EnableDebugLoggingParam && Bars.Count % 10 == 0)
                        _journal.Debug($"OTE Lifecycle: Using LOCKED OTE from {_state.ActiveOTETime:HH:mm} | 0.618={_state.ActiveOTE.OTE618:F5}");
                }
                else if (_state.ActiveMSS != null)
                {
                    // Detect OTE from active MSS and lock it
                    var oteFromMSS = _oteDetector.DetectOTEFromMSS(mssBars, mssSignals);
                    var oteFromSweep = _oteDetector.DetectOTEFromSweepToMSS(mssBars, sweeps, mssSignals);

                    // Combine both methods
                    oteZones = oteFromMSS ?? new List<OTEZone>();
                    if (oteFromSweep != null && oteFromSweep.Count > 0)
                    {
                        foreach (var altOte in oteFromSweep)
                        {
                            bool exists = oteZones.Any(z => Math.Abs(z.OTE618 - altOte.OTE618) < 0.0001);
                            if (!exists) oteZones.Add(altOte);
                        }
                    }

                    // Lock the first OTE zone matching the MSS direction
                    var oteToLock = oteZones.FirstOrDefault(z => z.Direction == _state.ActiveMSS.Direction);
                    if (oteToLock != null)
                    {
                        // OCT 28 EMERGENCY FIX: QUALITY GATE COMPLETELY DISABLED
                        // This entire quality gate block was blocking ALL entries (7.5% WR → need to restore 47% baseline first)
                        // Once baseline is restored, can re-enable quality filtering with proper thresholds

                        /* QUALITY GATE DISABLED - COMMENTED OUT OCT 28
                        // OCT 28 PHASE 2: SWING QUALITY FILTERING
                        // Check swing quality before locking OTE zone
                        bool passedQualityGate = true;

                        if (_learningEngine != null && _config.EnableAdaptiveLearning && _config.EnableSwingQualityFilter)
                        {
                            try
                            {
                                double swingHigh = Math.Max(oteToLock.ImpulseStart, oteToLock.ImpulseEnd);
                                double swingLow = Math.Min(oteToLock.ImpulseStart, oteToLock.ImpulseEnd);
                                double swingRangePips = (swingHigh - swingLow) / Symbol.PipSize;
                                string direction = (oteToLock.Direction == BiasDirection.Bullish) ? "Bullish" : "Bearish";
                                string session = GetCurrentSession();

                                // Estimate swing characteristics (will improve with real ATR later)
                                double estimatedATR = swingRangePips * Symbol.PipSize;
                                double swingDisplacementATR = (estimatedATR > 0) ? (swingRangePips * Symbol.PipSize / estimatedATR) : 0.25;
                                double swingDurationBars = 10.0;  // Placeholder - actual duration tracking pending

                                // Calculate swing quality score
                                double swingQuality = _learningEngine.CalculateSwingQuality(
                                    direction, swingRangePips, swingDurationBars, swingDisplacementATR, session);

                                // Determine session-specific threshold
                                double minQualityThreshold = _config.MinSwingQuality;
                                if (session == "London")
                                    minQualityThreshold = _config.MinSwingQualityLondon;
                                else if (session == "Asia")
                                    minQualityThreshold = _config.MinSwingQualityAsia;
                                else if (session == "NY")
                                    minQualityThreshold = _config.MinSwingQualityNY;
                                else if (session == "Other")
                                    minQualityThreshold = _config.MinSwingQualityOther;

                                // Quality gate check
                                if (swingQuality < minQualityThreshold)
                                {
                                    passedQualityGate = false;
                                    if (EnableDebugLoggingParam)
                                        _journal.Debug($"[QUALITY GATE] ❌ Swing REJECTED | Quality: {swingQuality:F2} < {minQualityThreshold:F2} | Session: {session} | Size: {swingRangePips:F1} pips | Direction: {direction}");
                                }

                                // Large swing rejection
                                if (_config.RejectLargeSwings && swingRangePips > _config.MaxSwingRangePips)
                                {
                                    passedQualityGate = false;
                                    if (EnableDebugLoggingParam)
                                        _journal.Debug($"[QUALITY GATE] ❌ Large swing REJECTED | Size: {swingRangePips:F1} pips > {_config.MaxSwingRangePips:F1} max | Session: {session} | Direction: {direction}");
                                }

                                // Log acceptance
                                if (passedQualityGate && EnableDebugLoggingParam)
                                    _journal.Debug($"[QUALITY GATE] ✅ Swing ACCEPTED | Quality: {swingQuality:F2} ≥ {minQualityThreshold:F2} | Session: {session} | Size: {swingRangePips:F1} pips | Direction: {direction}");
                            }
                            catch (Exception ex)
                            {
                                Print($"[QUALITY GATE] ERROR evaluating swing quality: {ex.Message}");
                                // Fail-open: allow the swing if quality check fails
                                passedQualityGate = true;
                            }
                        }

                        // Only lock OTE if it passed quality gate
                        if (!passedQualityGate)
                        {
                            if (EnableDebugLoggingParam)
                                _journal.Debug($"[QUALITY GATE] OTE lock SKIPPED due to low swing quality");

                            // Continue without locking OTE - will wait for better swing
                            oteZones = new List<OTEZone>();
                        }
                        else
                        {
                        */ // END QUALITY GATE DISABLED

                        // BYPASS QUALITY GATE - Lock OTE directly (baseline restoration mode)
                        {
                            // Quality gate passed - proceed with OTE lock
                            _state.ActiveOTE = oteToLock;
                            _state.ActiveOTETime = Server.Time;
                            oteZones = new List<OTEZone> { oteToLock }; // Use only the locked OTE

                            // Wire OTETouchDetector: Set OTE zone for touch detection
                            if (_oteTouchDetector != null)
                            {
                                TradeType oteDir = (oteToLock.Direction == BiasDirection.Bullish) ? TradeType.Buy : TradeType.Sell;
                                double swingHigh = Math.Max(oteToLock.ImpulseStart, oteToLock.ImpulseEnd);
                                double swingLow = Math.Min(oteToLock.ImpulseStart, oteToLock.ImpulseEnd);
                                _oteTouchDetector.SetOTEZone(swingHigh, swingLow, oteDir, Chart.TimeFrame);

                                if (EnableDebugLoggingParam)
                                    _journal.Debug($"[OTE DETECTOR] Zone set: {oteToLock.Direction} | Range: {swingLow:F5}-{swingHigh:F5} | OTE: {oteToLock.OTE618:F5}-{oteToLock.OTE79:F5}");
                            }

                            if (EnableDebugLoggingParam)
                                _journal.Debug($"OTE Lifecycle: LOCKED → {oteToLock.Direction} OTE | 0.618={oteToLock.OTE618:F5} | 0.79={oteToLock.OTE79:F5}");

                            // OCT 27 SWING LEARNING: Record swing characteristics and mark as used for OTE
                            if (_learningEngine != null && _config.EnableAdaptiveLearning)
                            {
                                try
                                {
                                    double swingHigh = Math.Max(oteToLock.ImpulseStart, oteToLock.ImpulseEnd);
                                    double swingLow = Math.Min(oteToLock.ImpulseStart, oteToLock.ImpulseEnd);
                                    double swingRangePips = (swingHigh - swingLow) / Symbol.PipSize;
                                    string direction = (oteToLock.Direction == BiasDirection.Bullish) ? "Bullish" : "Bearish";
                                    string session = GetCurrentSession();

                                    // Calculate swing characteristics
                                    // Estimate ATR displacement (simple approximation for now)
                                    double estimatedATR = swingRangePips * Symbol.PipSize;
                                    double swingDisplacementATR = (estimatedATR > 0) ? (swingRangePips * Symbol.PipSize / estimatedATR) : 0.25;
                                    double swingDurationBars = 10.0;  // Estimated duration (can be improved later)
                                    double bodyRatio = 0.7;  // Estimated body ratio (can be calculated from candles)
                                    bool cleanSwing = true;  // Assume clean swing (can be analyzed later)
                                    int touchCount = 1;  // Minimal touch count (can be calculated)
                                    double swingAngle = 45.0;  // Estimated angle (can be calculated)

                                    // Record the swing
                                    _learningEngine.RecordSwing(
                                        direction: direction,
                                        swingHigh: swingHigh,
                                        swingLow: swingLow,
                                        swingRangePips: swingRangePips,
                                        swingDurationBars: swingDurationBars,
                                        swingDisplacementATR: swingDisplacementATR,
                                        session: session,
                                        bodyRatio: bodyRatio,
                                        cleanSwing: cleanSwing,
                                        touchCount: touchCount,
                                        angle: swingAngle
                                    );

                                    // Mark swing as used for OTE
                                    _learningEngine.UpdateSwingOTEUsage(direction, swingHigh, swingLow);

                                    if (EnableDebugLoggingParam)
                                        _journal.Debug($"[SWING LEARNING] Recorded {direction} swing: {swingRangePips:F1} pips | Session: {session} | ATR: {swingDisplacementATR:F2}");
                                }
                                catch (Exception ex)
                                {
                                    Print($"[SWING LEARNING] ERROR recording swing: {ex.Message}");
                                }
                            }
                        }  // End of quality gate bypass block
                    }  // End of if (oteToLock != null)
                }
                else
                {
                    // No active MSS - detect OTE normally (legacy behavior)
                    oteZones = _oteDetector.DetectOTEFromMSS(mssBars, mssSignals);
                    var oteZonesAlt = _oteDetector.DetectOTEFromSweepToMSS(mssBars, sweeps, mssSignals);

                    if (oteZonesAlt != null && oteZonesAlt.Count > 0)
                    {
                        foreach (var altOte in oteZonesAlt)
                        {
                            bool exists = oteZones.Any(z => Math.Abs(z.OTE618 - altOte.OTE618) < 0.0001);
                            if (!exists) oteZones.Add(altOte);
                        }
                    }
                }

                if (EnableDebugLoggingParam && Bars.Count % 10 == 0 && oteZones != null)
                {
                    Print($"[DEBUG] OTE: {oteZones.Count} zones | Locked={(_state.ActiveOTE != null ? "YES" : "NO")}");
                    foreach (var ote in oteZones)
                        Print($"  OTE → {ote.Direction} | 0.618={ote.OTE618:F5} | 0.79={ote.OTE79:F5} | Range=[{ote.Low:F5}-{ote.High:F5}]");
                }
                // Remove legacy Continuation OTE and Sweep->MSS OTE; rely on core MSS-derived OTE + alternative

                // 6c) ENTRY-TF MSS/OTE: Use locked OTE if available (same as oteZones)
                var mssEntry = mssSignals;
                List<OTEZone> oteEntry;

                if (_state.ActiveOTE != null)
                {
                    // Use the same locked OTE
                    oteEntry = new List<OTEZone> { _state.ActiveOTE };
                }
                else
                {
                    // Fallback to detection (legacy)
                    oteEntry = _oteDetector.DetectOTEFromMSS(mssBars, mssEntry);
                    var oteEntryAlt = _oteDetector.DetectOTEFromSweepToMSS(mssBars, sweeps, mssEntry);
                    if (oteEntryAlt != null && oteEntryAlt.Count > 0)
                    {
                        foreach (var altOte in oteEntryAlt)
                        {
                            bool exists = oteEntry.Any(z => Math.Abs(z.OTE618 - altOte.OTE618) < 0.0001);
                            if (!exists) oteEntry.Add(altOte);
                        }
                    }
                }

                // 7) Order Blocks
                List<OrderBlock> orderBlocks;
                if (EnableDebugLoggingParam && Bars.Count % 10 == 0)
                {
                    Print($"[DEBUG] Sweeps: {sweeps.Count} detected");
                    foreach (var sweep in sweeps)
                        Print($"  SWEEP → {(sweep.IsBullish ? "Bullish" : "Bearish")} | {sweep.Label} | Price={sweep.Price:F5} | Time={sweep.Time:yyyy-MM-dd HH:mm}");
                }
                if (_config.UseHtfOrderBlocks)
                {
                    var htfBars = MarketData.GetBars(_config.HtfObTimeFrame);
                    var nestedBars = MarketData.GetBars(_config.NestedObTimeFrame);

                    // HTF OBs
                    var obHtf = _obDetector.DetectOrderBlocks(htfBars, mssSignals, sweeps) ?? new List<OrderBlock>();

                    // Nested OBs within current HTF leg: from last pivot time
                    DateTime pivotTime = htfBars.OpenTimes[Math.Max(0, htfBars.Count - 5)];
                    try
                    {
                        // choose pivot aligned with bias: bullish -> last swing low; bearish -> last swing high
                        int iLast = htfBars.Count - 2;
                        var highs = htfBars.HighPrices.Select(x => (double)x).ToList();
                        var lows  = htfBars.LowPrices.Select(x => (double)x).ToList();
                        int pivot = 3;
                        if (bias == BiasDirection.Bullish)
                        {
                            for (int k = iLast; k >= pivot; k--) if (CCTTB.MSS.Core.Detectors.SwingDetector.IsSwingLow(lows, k, pivot, true)) { pivotTime = htfBars.OpenTimes[k]; break; }
                        }
                        else if (bias == BiasDirection.Bearish)
                        {
                            for (int k = iLast; k >= pivot; k--) if (CCTTB.MSS.Core.Detectors.SwingDetector.IsSwingHigh(highs, k, pivot, true)) { pivotTime = htfBars.OpenTimes[k]; break; }
                        }
                    }
                    catch { }

                    var obNestedAll = _obDetector.DetectOrderBlocks(nestedBars, mssSignals, sweeps) ?? new List<OrderBlock>();
                    var obNested = obNestedAll.Where(ob => ob.Time >= pivotTime).ToList();
                    orderBlocks = obHtf.Concat(obNested).OrderByDescending(ob => ob.Time).ToList();
                }
                else
                {
                    orderBlocks = _obDetector.DetectOrderBlocks(Bars, mssSignals, sweeps);
                }

                if (EnableDebugLoggingParam && Bars.Count % 10 == 0)
                {
                    Print($"[DEBUG] OrderBlocks: {orderBlocks?.Count ?? 0} detected");
                    if (orderBlocks != null)
                        foreach (var ob in orderBlocks.Take(5)) // Show first 5 to avoid spam
                            Print($"  OB → {ob.Direction} | Range=[{ob.LowPrice:F5}-{ob.HighPrice:F5}] | Stop={ob.StopPrice:F5} | Time={ob.Time:yyyy-MM-dd HH:mm}");
                }

                // 7b) Breaker blocks from HTF OB invalidations (compute before confirmations/execute)
                var breakerBlocks = ComputeHtfBreakers(MarketData.GetBars(_config.HtfObTimeFrame));
                if (EnableDebugLoggingParam && Bars.Count % 10 == 0)
                {
                    Print($"[DEBUG] Breaker blocks: {breakerBlocks?.Count ?? 0} detected");
                    if (breakerBlocks != null)
                        foreach (var brk in breakerBlocks.Take(5)) // Show first 5 to avoid spam
                            Print($"  BREAKER → {brk.Direction} | Range=[{brk.LowPrice:F5}-{brk.HighPrice:F5}] | Idx={brk.Index}");
                }

                // 7c) Native FVG zones (last N bars)
                var fvgZones = new List<FVGZone>();
                {
                    var highs = Bars.HighPrices.Select(x => (double)x).ToList();
                    var lows  = Bars.LowPrices.Select(x => (double)x).ToList();
                    int scan = Math.Min(120, Bars.Count - 2);
                    int startScan = Math.Max(2, Bars.Count - scan);
                    for (int i = startScan; i < Bars.Count - 1; i++)
                    {
                        var bull = CCTTB.MSS.Core.Detectors.FVGDetector.GapBoundsBullish(highs, lows, i, minGap: 0.0);
                        if (bull.HasValue)
                            fvgZones.Add(new FVGZone { Time = Bars.OpenTimes[i], Direction = BiasDirection.Bullish, Low = bull.Value.low, High = bull.Value.high });
                        var bear = CCTTB.MSS.Core.Detectors.FVGDetector.GapBoundsBearish(highs, lows, i, minGap: 0.0);
                        if (bear.HasValue)
                            fvgZones.Add(new FVGZone { Time = Bars.OpenTimes[i], Direction = BiasDirection.Bearish, Low = bear.Value.low, High = bear.Value.high });
                    }
                }

                if (EnableDebugLoggingParam && Bars.Count % 10 == 0)
                {
                    Print($"[DEBUG] FVG zones: {fvgZones?.Count ?? 0} detected");
                    if (fvgZones != null && fvgZones.Count > 0)
                        foreach (var fvg in fvgZones.TakeLast(5)) // Show last 5 to avoid spam
                            Print($"  FVG → {fvg.Direction} | Range=[{fvg.Low:F5}-{fvg.High:F5}] | Time={fvg.Time:yyyy-MM-dd HH:mm}");
                }

                // ──────────────────────────────────────────────────────────────────────────
                // MULTI-ENTRY SYSTEM: Update signal box tracking and check for touches
                // ──────────────────────────────────────────────────────────────────────────
                UpdateSignalBoxes(oteZones, orderBlocks);
                CheckSignalBoxTouches(Symbol.Bid, Symbol.Ask);

                // 8) Confirmations
                if (mssSignals.Any()) { confirmedZones.Add("MSS"); tagsIdx["MSS"] = mssSignals[mssSignals.Count-1].Index; }
                if (oteZones.Any() || oteEntry.Any()) { confirmedZones.Add("OTE"); int idxOTE = Bars.Count-1; if (oteZones.Any()) { var z=oteZones[oteZones.Count-1]; idxOTE = Bars.OpenTimes.GetIndexByTime(z.Time); if (idxOTE<0) idxOTE = Bars.Count-1; } tagsIdx["OTE"]=Math.Max(0, idxOTE-1); }
                if (orderBlocks.Any()) confirmedZones.Add("OrderBlock");
                if (breakerBlocks != null && breakerBlocks.Count > 0) { confirmedZones.Add("Breaker"); tagsIdx["BREAKER"] = breakerBlocks[breakerBlocks.Count-1].Index; }
                // IFVG: only when inversion retest exists
                var ifvgRetests = DeriveIfvgRetests(Bars, maxScanBars: 200);
                if (ifvgRetests != null && ifvgRetests.Count > 0)
                {
                    confirmedZones.Add("IFVG");
                    try
                    {
                        var t = ifvgRetests[ifvgRetests.Count - 1].Time;
                        int idx = Bars.OpenTimes.GetIndexByTime(t);
                        if (idx < 0) idx = Bars.Count - 2;
                        tagsIdx["IFVG"] = idx;
                    }
                    catch
                    {
                        tagsIdx["IFVG"] = Bars.Count - 2;
                    }
                }

                // SMT confirmation (optional)
                bool? smtDir = null;
                if (_config.EnableSMT && !string.IsNullOrWhiteSpace(_config.SMT_CompareSymbol))
                {
                    smtDir = ComputeSmtSignal(_config.SMT_CompareSymbol, _config.SMT_TimeFrame, _config.SMT_Pivot);
                    if (smtDir != null) confirmedZones.Add("SMT");
                }

                bool entryAllowed = _entryConfirmation.IsEntryAllowed(confirmedZones);

                // SIMPLIFIED KILLZONE: Always use inKillzone (orchestrator preset or legacy calculation)
                // Removed redundant EnableKillzoneGate parameter - only use inKillzone boolean
                bool killzoneCheck = inKillzone;

                if (_config.EnableDebugLogging)
                    _journal.Debug($"EntryCheck: allowed={entryAllowed} killzoneGate={_config.EnableKillzoneGate} inKillzone={inKillzone} killzoneCheck={killzoneCheck} orchestrator={(_orc != null ? "active" : "inactive")} confirmed={string.Join(",", confirmedZones)}");

                // 9) Execute (supports strict MSS-OTE-only mode)
                if (entryAllowed && killzoneCheck)
                {
                    // News gates
                    var tod = Server.Time.TimeOfDay;
                    if (_config.EnableNewsBlackout && IsWithinBlackout(tod, _config.NewsBlackoutWindows))
                    {
                        if (_config.EnableDebugLogging) _journal.Debug("Entry gated: news blackout");
                        _tradeManager.ManageOpenPositions(Symbol);
                        return;
                    }
                    if (_config.EnableNewsModeOnly && !IsWithinTradeWindow(tod, _config.NewsTradeWindows))
                    {
                        if (_config.EnableDebugLogging) _journal.Debug("Entry gated: outside news trade window");
                        _tradeManager.ManageOpenPositions(Symbol);
                        return;
                    }

                    // ═══════════════════════════════════════════════════════════════
                    // DEAD ZONE FILTER (Oct 26, 2025)
                    // ═══════════════════════════════════════════════════════════════
                    // Block trades during 17:00-18:00 UTC (end of NY / pre-Asia dead zone)
                    // Analysis: 22% win rate during this period vs 67% during killzones
                    // Reason: Low liquidity, high chop, whipsaws
                    if (_config.EnableDeadZoneFilter)
                    {
                        int utcHour = Server.TimeInUtc.Hour;
                        if (utcHour >= _config.DeadZoneStartHour && utcHour < _config.DeadZoneEndHour)
                        {
                            if (_config.EnableDebugLogging)
                                _journal.Debug($"[DEAD_ZONE] Skipping entry | UTC Hour: {utcHour} | Dead Zone: {_config.DeadZoneStartHour:00}:00-{_config.DeadZoneEndHour:00}:00");
                            _tradeManager.ManageOpenPositions(Symbol);
                            return;
                        }
                    }

                    var dailyBias = GetBiasForTf(_config.BiasTimeFrame);

                    // NOTE: Auto-close on daily bias shift DISABLED (Oct 22, 2025)
                    // Reason: Closes winning positions prematurely (e.g., +16.16 Bullish closed at 17:15)
                    // Let TP/SL manage exits instead of HTF bias shifts

                    // DEBUG: Log OTE zones before filtering
                    if (EnableDebugLoggingParam && oteZones != null && oteZones.Count > 0)
                    {
                        _journal.Debug($"PRE-FILTER OTE: {oteZones.Count} zones | dailyBias={dailyBias}");
                        foreach (var ote in oteZones)
                            _journal.Debug($"  OTE pre-filter: Dir={ote.Direction} | 0.618={ote.OTE618:F5} | 0.79={ote.OTE79:F5}");
                    }

                    // FILTER DIRECTION LOGIC (Oct 26, 2025 - REVERTED):
                    // ORIGINAL LOGIC RESTORED: MSS direction takes priority over daily bias
                    // Reason: Session analysis showed 67% win rate with MSS fallback vs 22% with HTF bias priority
                    // HTF bias conflicts with LTF structure during choppy markets (17:30 session -$691 PnL)
                    var activeMssDir = _state.ActiveMSS?.Direction ?? BiasDirection.Neutral;
                    var filterDir = activeMssDir != BiasDirection.Neutral ? activeMssDir : dailyBias;

                    // RATIONALE (UPDATED): MSS is more responsive to current market structure
                    // HTF bias useful as fallback when MSS=Neutral, but MSS is primary signal
                    // Proven: 67% win rate (MSS priority) vs 22% win rate (HTF priority)

                    if (EnableDebugLoggingParam)
                        _journal.Debug($"OTE FILTER: dailyBias={dailyBias} | activeMssDir={activeMssDir} | filterDir={filterDir}");

                    var proOte = (oteZones ?? new List<OTEZone>()).Where(z => z.Direction == filterDir).ToList();
                    var proOb  = (orderBlocks ?? new List<OrderBlock>()).Where(ob => ob.Direction == filterDir).ToList();

                    // DEBUG: Log OTE zones after filtering
                    if (EnableDebugLoggingParam)
                        _journal.Debug($"POST-FILTER OTE: {proOte.Count} zones (filtered from {oteZones?.Count ?? 0})");

                    // Apply PO3/Asia gating: require recent Asia sweep and direction opposite sweep
                    BiasDirection? po3Dir = null;
                    if (_config.EnablePO3 || _config.RequireAsiaSweepBeforeEntry)
                    {
                        UpdateAsiaState();
                        po3Dir = GetPo3PreferredDirection();
                        if (_config.RequireAsiaSweepBeforeEntry && po3Dir == null)
                        {
                            if (_config.EnableDebugLogging) _journal.Debug("PO3 gate: no Asia sweep detected");
                            _tradeManager.ManageOpenPositions(Symbol);
                            return;
                        }
                    }

                    // Apply Intraday bias gate from frames logic: last sweep since day open + 15m shift
                    BiasDirection? intradayDir = null;
                    if (_config.EnableIntradayBias)
                    {
                        intradayDir = GetIntradayPreferredDirection(sweeps);
                    }

                    // Weekly accumulation bias: Mon/Tue range swept then shift on chosen TF
                    BiasDirection? weeklyAccumDir = null;
                    if (_config.EnableWeeklyAccumulationBias)
                    {
                        weeklyAccumDir = GetWeeklyAccumPreferredDirection();
                    }

                    // Try strict MSS completion OTE first if enabled
                    TradeSignal signal = null;
                    string signalLabel = "Jadecap-Pro";
                    if (_config.StrictOteAfterMssCompletion)
                    {
                        var mssLast = (mssSignals ?? new List<MSSSignal>()).LastOrDefault(s => s.IsValid);
                        if (mssLast != null)
                        {
                            var contOte = _oteDetector.DetectContinuationOTE(mssBars, mssSignals) ?? new List<OTEZone>();
                            signal = BuildTradeSignal(mssLast.Direction, contOte, proOb, mssSignals, breakerBlocks, fvgZones, sweeps);
                            signalLabel = "Jadecap-Pro";
                        }
                    }

                    // If strict produced no signal, try pro-trend
                    if (signal == null)
                    {
                        if (filterDir != BiasDirection.Neutral)
                        {
                            // prefer entry-TF OTE zones when available, filter by MSS direction (not dailyBias)
                            var proOteCombined = oteEntry.Any() ? oteEntry.Where(z => z.Direction == filterDir).ToList() : proOte;
                            signal = BuildTradeSignal(filterDir, proOteCombined, proOb, mssSignals, breakerBlocks, fvgZones, sweeps);
                            signalLabel = "Jadecap-Pro";
                        }
                    }

                    if (filterDir != BiasDirection.Neutral)
                    {
                        // prefer entry-TF OTE zones when available, filter by MSS direction (not dailyBias)
                        var proOteCombined = oteEntry.Any() ? oteEntry.Where(z => z.Direction == filterDir).ToList() : proOte;
                        signal = BuildTradeSignal(filterDir, proOteCombined, proOb, mssSignals, breakerBlocks, fvgZones, sweeps);
                        signalLabel = "Jadecap-Pro";
                    }
                    // Legacy CT flow removed


                    // Legacy CT check removed

                    // Re-entry on retap of the same OTE zone (video option)
                    if (signal == null && _config.EnableReEntry && _state.LastEntryDir != BiasDirection.Neutral)
                    {
                        int nowBar = Bars != null ? Bars.Count - 1 : -1;
                        if (!(nowBar >= 0 && nowBar <= _state.ReEntryCooldownUntilBar))
                        {
                            if (_state.ReEntryCount < Math.Max(0, _config.ReEntryMax) &&
                                nowBar - _state.LastEntryBarIndex <= Math.Max(1, _config.ReEntryWithinBars) &&
                                !double.IsNaN(_state.LastOteLo) && !double.IsNaN(_state.LastOteHi) &&
                                PriceTouchesZone(_state.LastOteLo, _state.LastOteHi, Symbol.PipSize * Math.Max(0.1, _config.TapTolerancePips)))
                            {
                                var dir = _state.LastEntryDir;
                                double entry = (dir == BiasDirection.Bullish) ? Symbol.Ask : Symbol.Bid;
                                double stop = (dir == BiasDirection.Bullish) ? (_state.LastOteLo - _config.StopBufferPipsOTE * Symbol.PipSize)
                                                                             : (_state.LastOteHi + _config.StopBufferPipsOTE * Symbol.PipSize);
                                if (dir == BiasDirection.Bullish && stop >= entry) stop = entry - 10 * Symbol.PipSize;
                                if (dir == BiasDirection.Bearish && stop <= entry) stop = entry + 10 * Symbol.PipSize;

                                // Calculate TP using MSS opposite liquidity (same as main OTE signal)
                                double? tpPriceRe = null;
                                if (_config.UseOppositeLiquidityTP)
                                {
                                    double rawStopPips = Math.Abs(entry - stop) / Symbol.PipSize;
                                    var opp = FindOppositeLiquidityTargetWithMinRR(dir == BiasDirection.Bullish, entry, rawStopPips, _config.MinRiskReward);
                                    if (opp.HasValue)
                                    {
                                        double spreadPipsNow = Symbol.Spread / Symbol.PipSize;
                                        if (_config.SpreadCushionUseAvg && _state.SpreadPips.Count > 0)
                                        {
                                            double sum = 0; foreach (var v in _state.SpreadPips) sum += v; spreadPipsNow = sum / _state.SpreadPips.Count;
                                        }
                                        double cushion = _config.EnableTpSpreadCushion ? Math.Max(spreadPipsNow, _config.SpreadCushionExtraPips) : _config.SpreadCushionExtraPips;
                                        tpPriceRe = (dir == BiasDirection.Bullish) ? (opp.Value - (_config.TpOffsetPips + cushion) * Symbol.PipSize)
                                                                                   : (opp.Value + (_config.TpOffsetPips + cushion) * Symbol.PipSize);
                                    }
                                }

                                signal = new TradeSignal { Direction = dir, EntryPrice = entry, StopLoss = stop, TakeProfit = tpPriceRe ?? 0.0, Timestamp = Server.Time };
                                signalLabel = "Jadecap-Re";
                                if (_config.EnableDebugLogging)
                                {
                                    double rrRe = tpPriceRe.HasValue ? Math.Abs(tpPriceRe.Value - entry) / Math.Max(1e-6, Math.Abs(entry - stop)) : 0;
                                    _journal.Debug($"Re-entry: retap of last OTE zone | entry={entry:F5} stop={stop:F5} tp={tpPriceRe?.ToString("F5") ?? "fallback"} | RR={rrRe:F2}");
                                }

                                // Apply phase-based logic (Phase 3 for re-entry/OTE retap)
                                signal = ApplyPhaseLogic(signal, "OTE");
                            }
                        }
                    }

                    // PO3 direction filter
                    if (signal != null && po3Dir != null && signal.Direction != po3Dir.Value)
                    {
                        if (_config.EnableDebugLogging) _journal.Debug($"PO3 gate: direction mismatch (signal {signal.Direction} vs {po3Dir})");
                        signal = null;
                    }

                    // Intraday bias filter (DayOpen+sweep+shift)
                    if (signal != null && intradayDir != null && signal.Direction != intradayDir.Value)
                    {
                        if (_config.EnableDebugLogging) _journal.Debug($"Intraday gate: direction mismatch (signal {signal.Direction} vs {intradayDir})");
                        signal = null;
                    }

                    // Weekly accumulation filter (Mon/Tue range sweep + shift)
                    if (signal != null && weeklyAccumDir != null && signal.Direction != weeklyAccumDir.Value)
                    {
                        if (_config.EnableDebugLogging) _journal.Debug($"Weekly-Accum gate: direction mismatch (signal {signal.Direction} vs {weeklyAccumDir})");
                        signal = null;
                    }

                    if (signal != null && _tradeManager.CanOpenNewTrade(signal))
                    {
                        // SMT as filter
                        if (_config.EnableSMT && _config.SMT_AsFilter && smtDir != null)
                        {
                            bool smtIsBull = smtDir.Value;
                            if ((smtIsBull && signal.Direction != BiasDirection.Bullish) || (!smtIsBull && signal.Direction != BiasDirection.Bearish))
                            {
                                if (_config.EnableDebugLogging) _journal.Debug("SMT filter: direction mismatch");
                                signal = null;
                            }
                        }
                    }

                    if (signal != null && _tradeManager.CanOpenNewTrade(signal))
                    {
                        // CT label removal; only pro signals are executed

                        signal.Label = signalLabel;
                        if (_config.EnableDebugLogging) _journal.Debug($"Execute: {signalLabel} {signal.Direction} entry={signal.EntryPrice:F5} stop={signal.StopLoss:F5} tp={(signal.TakeProfit>0?signal.TakeProfit.ToString("F5"):"-")}");

                        // MULTI-ENTRY: Mark the signal box that triggered this entry
                        var entryBox = GetNextEntryBox(signal.Direction);
                        if (entryBox != null)
                        {
                            MarkBoxEntryTaken(entryBox);
                            if (_config.EnableDebugLogging)
                                _journal.Debug($"Entry from SignalBox: {entryBox.Type} {entryBox.Direction} created at {entryBox.Time:HH:mm}");
                        }

                        // Draw entry signal marker on chart
                        _drawer.DrawEntrySignal(signal);

                        EnsureOrchestrator(); if (_orc != null) EnsureOrchestrator(); if (_orc != null) _orc.Submit(signal);
                        _journal.LogTrade(signal, Server.Time);
                        _state.LastEntryBarIndex = Bars != null ? Bars.Count - 1 : _state.LastEntryBarIndex;

                        // MSS Lifecycle: Mark entry occurred (will trigger MSS reset on next bar)
                        if (_state.ActiveMSS != null)
                        {
                            _state.MSSEntryOccurred = true;
                            if (EnableDebugLoggingParam)
                                _journal.Debug($"MSS Lifecycle: ENTRY OCCURRED on {signal.Direction} signal → Will reset ActiveMSS on next bar");
                        }
                        if (_config.EnableReEntry)
                        {
                            if (signalLabel == "Jadecap-Re")
                            {
                                _state.ReEntryCount++;
                                _state.ReEntryCooldownUntilBar = (_state.LastEntryBarIndex >= 0) ? _state.LastEntryBarIndex + Math.Max(0, _config.ReEntryCooldownBars) : -1;
                            }
                            else
                            {
                                _state.ReEntryCount = 0;
                                _state.ReEntryCooldownUntilBar = -1;
                            }
                        }
                    }
                    else
                    {
                        if (_config.EnableDebugLogging)
                        {
                            if (signal == null) _journal.Debug("No signal built (gated by sequence/pullback/other)");
                            else _journal.Debug("Capacity blocked: at or over position cap");
                        }
                    }
                }
                else if (_config.EnableDebugLogging)
                {
                    if (_orc != null)
                    {
                        if (!inKillzone)
                        {
                            var activePresets = _orc.GetActivePresetNames();
                            var kzInfo = _orc.GetKillzoneInfo();
                            _journal.Debug($"Entry gated: inKillzone={inKillzone} (preset mode) | Active={activePresets} | KZ={kzInfo.start:hh\\:mm}-{kzInfo.end:hh\\:mm}");
                        }
                        else
                        {
                            _journal.Debug($"Entry gated: entryAllowed={entryAllowed} (confirmation issue)");
                        }
                    }
                    else
                    {
                        _journal.Debug($"Entry gated: not allowed or outside killzone (legacy mode) | killzoneGate={_config.EnableKillzoneGate} inKillzone={inKillzone}");
                    }
                }

                // Actively manage open positions (BE / partial / trail)
                _tradeManager.ManageOpenPositions(Symbol);

                // --- Step 10: Draw visuals ---

                // latest MSS direction (native)
                BiasDirection? lastMssDir = null;
                if (mssSignals != null && mssSignals.Count > 0)
                {
                    for (int i = mssSignals.Count - 1; i >= 0; i--)
                        if (mssSignals[i].IsValid) { lastMssDir = mssSignals[i].Direction; break; }
                }

                // 1) Bias banner (with TF)
                // Update HUD bias display
                if (_config.EnableDebugLogging && Bars.Count % 50 == 0)
                    Print($"[VISUAL DEBUG] Drawing bias status panel: Bias={bias}, TF={_config.BiasTimeFrame}");
                _drawer.DrawBiasStatus(bias, _config.BiasTimeFrame);
                // Draw bias swings for visual validation
                _drawer.DrawBiasSwings(_config.BiasTimeFrame, pivot: 3);
                // Key legend (positionable)
                if (_config.ColorizeKeyLevelLabels)
                {
                    var (lv, lh) = ParseAlignment(_config.LegendPosition);
                    _drawer.DrawKeyLegend(lv, lh);
                }

                // Summary line (top-center)
                BiasDirection? intradayPrefHUD = _config.EnableIntradayBias ? GetIntradayPreferredDirection(sweeps) : null;
                BiasDirection? weeklyPrefHUD = _config.EnableWeeklyAccumulationBias ? GetWeeklyAccumPreferredDirection() : null;
                string summary = $"KZ:{(inKillzone ? "ON" : "OFF")}  Preset:{_config.EntryPreset}  Intraday:{(intradayPrefHUD?.ToString() ?? "-")}  WeeklyAcc:{(weeklyPrefHUD?.ToString() ?? "-")}";
                var (sv, sh) = ParseAlignment(_config.SummaryPosition);
                _drawer.DrawSummary(summary, sv, sh);

                // 2) PDH/PDL (+ EQ50)
                _drawer.DrawPDH_PDL(drawEq50: true);

                // Draw day open vertical line
                try { if (_drawer.TryGetPrevDayLevels(out var __pdh, out var __pdl, out var __eq, out var __do)) _drawer.DrawDayOpen(__do); } catch { }
                // Draw current day H/L
                _drawer.DrawCurrentDayHL();
                // Draw Killzone boundaries
                try {
                    var _off = TimeSpan.FromHours(GetSessionOffsetHours(Server.Time));
                    var d0Sess = (Server.Time + _off).Date;
                    var kzS = (d0Sess + _config.KillZoneStart) - _off;
                    var kzE = (d0Sess + _config.KillZoneEnd) - _off;
                    _drawer.DrawKillZoneBounds(kzS, kzE);
                } catch { }
                // also fetch PD levels to label sweeps exactly
                double? pdh = null, pdl = null;
                {
                    if (_drawer.TryGetPrevDayLevels(out var _pdh, out var _pdl, out var _eq, out _))
                    { pdh = _pdh; pdl = _pdl; /* eq available if needed */ }
                }

                // Mon/Tue range overlay (for Weekly Accumulation frames)
                if (_config.EnableWeeklyAccumulationBias && _config.ShowMonTueOverlay && TryGetMonTueRange(out var wHi, out var wLo, out var wStart, out var wEnd))
                {
                    _drawer.DrawMonTueRange(wStart, wEnd, wLo, wHi);
                }

                // 3) Swings as lines (from your zones)
                _drawer.DrawSwingLinesFromZones(_marketData.GetLiquidityZones(), mergePips: 2.0);

                // 4) Liquidity sweeps (labels include PDH/PDL Sweep when applicable)
                _drawer.DrawSweeps(sweeps, pdh, pdl);

                _drawer.DrawLiquiditySideLabels(pdh, pdl, Server.Time.Date);
                // 5) MSS as line and (optional) fib-pack from latest MSS
                _drawer.DrawMSS(mssSignals);
                var latestMss = (mssSignals ?? new List<MSSSignal>()).LastOrDefault(s => s.IsValid);
                if (latestMss != null)
                {
                    _drawer.DrawBOS(latestMss);
                    _drawer.DrawImpulseZones(latestMss, 20);
                }
                if (_config.EnableMssFibPack && latestMss != null)
                    _drawer.DrawFibPackFromMSS(latestMss, minutes: 45);

                // 6) OTE boxes - main TF and entry TF (entry TF uses shorter box duration)
                if (_config.EnableDebugLogging)
                {
                    Print($"[VISUAL DEBUG] Drawing {oteZones?.Count ?? 0} OTE boxes (main TF)");
                    if (oteZones != null && oteZones.Any())
                    {
                        foreach (var ote in oteZones)
                        {
                            Print($"[VISUAL DEBUG] OTE box: 618={ote.OTE618:F5}, 79={ote.OTE79:F5}, time={ote.Time:HH:mm}, dir={ote.Direction}");
                        }
                    }
                }
                _drawer.DrawOTE(oteZones, boxMinutes: 45, drawEq50: OteDrawExtras, mssDirection: lastMssDir, enforceDailyEqSide: true);

                if (oteEntry.Any())
                {
                    if (_config.EnableDebugLogging)
                        Print($"[VISUAL DEBUG] Drawing {oteEntry.Count} OTE boxes (entry TF)");
                    _drawer.DrawOTE(oteEntry, boxMinutes: 20, drawEq50: OteDrawExtras, mssDirection: lastMssDir, enforceDailyEqSide: true);
                }
                // no sweep-MSS OTE overlay (legacy path removed)
                // draw sequence OB at sweep candle if gated
                if (_config.EnablePOIBoxDraw && _config.EnableSequenceGate)
                {
                    int swIdx, msIdx;
                    if (ValidateSequenceGate(bias, sweeps, mssSignals, out swIdx, out msIdx) && swIdx >= 0)
                    {
                        double lo = Bars.LowPrices[swIdx];
                        double hi = Bars.HighPrices[swIdx];
                        _drawer.DrawSequenceObOverlay(Bars.OpenTimes[swIdx], lo, hi, 30, _config.SequenceObColor);
                    }
                }

                // 7) Order Blocks boxes
                _drawer.DrawOrderBlocks(orderBlocks, boxMinutes: 30);
                _drawer.DrawBreakerBlocks(breakerBlocks, boxMinutes: 30);
                if (_config.EnableFVGDraw)
                {
                    foreach (var fvg in fvgZones.Take(Math.Max(1, _config.MaxFVGBoxes)))
                    {
                        var c = (fvg.Direction == BiasDirection.Bullish) ? _config.BullishColor : _config.BearishColor;
                        _drawer.DrawFVG(fvg.Time, fvg.Low, fvg.High, boxMinutes: 30, overrideColor: c);
                    }
                }
            }
            catch (Exception ex)
            {
                Print($"[ONBAR ERROR] ========================================");
                Print($"[ONBAR ERROR] ❌ Exception in OnBar logic");
                Print($"[ONBAR ERROR] Type: {ex.GetType().Name}");
                Print($"[ONBAR ERROR] Message: {ex.Message}");
                Print($"[ONBAR ERROR] Bar Index: {Bars.Count}");
                Print($"[ONBAR ERROR] Time: {Server.Time}");
                if (_config.EnableDebugLogging && ex.StackTrace != null)
                {
                    Print($"[ONBAR ERROR] Stack Trace:");
                    Print($"[ONBAR ERROR] {ex.StackTrace}");
                }
                if (ex.InnerException != null)
                {
                    Print($"[ONBAR ERROR] Inner Exception: {ex.InnerException.Message}");
                }
                Print($"[ONBAR ERROR] ========================================");
                // Don't re-throw - allow bot to continue on next bar
            }
        }

        // Optional: smoother trailing on ticks
        protected override void OnTick()
        {
            _tradeManager?.ManageOpenPositions(Symbol);
            if (_config.EnableDebugLogging)
            {
                // Maintain a small moving window of spread pips for TP cushion and log occasionally
                double spreadPips = Symbol.Spread / Symbol.PipSize;
                _state.SpreadPips.Enqueue(spreadPips);
                while (_state.SpreadPips.Count > Math.Max(10, _config.SpreadAvgPeriod)) _state.SpreadPips.Dequeue();
            }
        }

        protected override void OnStop()
        {
            // OCT 27 ADAPTIVE LEARNING - Save daily data
            if (_config != null && _config.EnableAdaptiveLearning && _learningEngine != null)
            {
                try
                {
                    _learningEngine.SaveDailyData();
                    Print("[ADAPTIVE LEARNING] Daily data saved on bot stop");
                }
                catch (Exception ex)
                {
                    Print($"[ADAPTIVE LEARNING] ERROR saving daily data: {ex.Message}");
                }
            }

            if (EnableFileLoggingParam)
                _journal.SaveToFile();
            Print("Jadecap Strategy Bot Stopped");
        }

        // ═══════════════════════════════════════════════════════════════════════════════
        // SIGNAL BOX MANAGEMENT - First Touch & Re-Entry System
        // ═══════════════════════════════════════════════════════════════════════════════

        /// <summary>
        /// Update signal box registry with current OTE and OB zones
        /// </summary>
        private void UpdateSignalBoxes(List<OTEZone> oteZones, List<OrderBlock> orderBlocks)
        {
            if (_state.TouchedBoxes == null)
                _state.TouchedBoxes = new List<SignalBox>();

            // Add new OTE zones to tracking
            if (oteZones != null)
            {
                foreach (var ote in oteZones)
                {
                    string id = $"OTE_{ote.Time.Ticks}_{ote.Direction}";
                    if (!_state.TouchedBoxes.Any(b => b.UniqueId == id))
                    {
                        _state.TouchedBoxes.Add(new SignalBox
                        {
                            Type = "OTE",
                            UniqueId = id,
                            Time = ote.Time,
                            Low = Math.Min(ote.OTE618, ote.OTE79),
                            High = Math.Max(ote.OTE618, ote.OTE79),
                            Direction = ote.Direction,
                            Touched = false,
                            EntryTaken = false,
                            SourceSignal = ote
                        });
                    }
                }
            }

            // Add new OrderBlock zones to tracking
            if (orderBlocks != null)
            {
                foreach (var ob in orderBlocks)
                {
                    string id = $"OB_{ob.Time.Ticks}_{ob.Direction}";
                    if (!_state.TouchedBoxes.Any(b => b.UniqueId == id))
                    {
                        _state.TouchedBoxes.Add(new SignalBox
                        {
                            Type = "OB",
                            UniqueId = id,
                            Time = ob.Time,
                            Low = ob.LowPrice,
                            High = ob.HighPrice,
                            Direction = ob.Direction,
                            Touched = false,
                            EntryTaken = false,
                            SourceSignal = ob
                        });
                    }
                }
            }

            // Clean up old boxes (older than 200 bars)
            _state.TouchedBoxes.RemoveAll(b => b.Time < Server.Time.AddHours(-48));
        }

        /// <summary>
        /// Check if price has touched any signal boxes and update their status
        /// </summary>
        private void CheckSignalBoxTouches(double currentBid, double currentAsk)
        {
            if (_state.TouchedBoxes == null) return;

            foreach (var box in _state.TouchedBoxes.Where(b => !b.Touched))
            {
                // Check if price is touching this box
                double mid = (currentBid + currentAsk) / 2.0;
                bool touching = mid >= box.Low && mid <= box.High;

                if (touching)
                {
                    box.Touched = true;
                    box.TouchTime = Server.Time;

                    if (_config.EnableDebugLogging)
                        _journal.Debug($"SignalBox TOUCHED: {box.Type} {box.Direction} at {box.TouchTime:HH:mm} | Box=[{box.Low:F5}-{box.High:F5}]");
                }
            }
        }

        /// <summary>
        /// Get the first untouched signal box that has been touched but no entry taken yet
        /// Returns null if no boxes available for entry
        /// </summary>
        private SignalBox GetNextEntryBox(BiasDirection entryDirection)
        {
            if (_state.TouchedBoxes == null) return null;

            // Find first touched box matching direction that hasn't had entry yet
            return _state.TouchedBoxes
                .Where(b => b.Direction == entryDirection)
                .Where(b => b.Touched && !b.EntryTaken)
                .OrderBy(b => b.TouchTime)
                .FirstOrDefault();
        }

        /// <summary>
        /// Mark a signal box as having an entry taken
        /// </summary>
        private void MarkBoxEntryTaken(SignalBox box)
        {
            if (box == null) return;

            box.EntryTaken = true;
            box.EntryTime = Server.Time;

            if (_config.EnableDebugLogging)
                _journal.Debug($"SignalBox ENTRY TAKEN: {box.Type} {box.Direction} | Box=[{box.Low:F5}-{box.High:F5}]");
        }

        // ═══════════════════════════════════════════════════════════════════════════════

        private TradeSignal BuildTradeSignal(
        BiasDirection bias,
        List<OTEZone> oteZones,
        List<OrderBlock> orderBlocks,
        List<MSSSignal> mssSignals,
        List<BreakerBlock> breakerBlocks = null,
        List<FVGZone> fvgZones = null,
        List<LiquiditySweep> sweeps = null)
        {
            // ═══════════════════════════════════════════════════════════════════
            // UNIFIED CONFIDENCE: Store context for confidence calculation
            // ═══════════════════════════════════════════════════════════════════
            _currentMssSignals = mssSignals;
            _currentSweeps = sweeps;
            _currentSmtDirection = null; // Will be set later if SMT enabled

            // NEW: Check if news analysis blocks new entries
            NewsContextAnalysis newsContext = null;
            lock (_analysisLock)
            {
                newsContext = _currentNewsContext;
            }

            if (newsContext != null && newsContext.BlockNewEntries)
            {
                if (_config.EnableDebugLogging)
                    _journal.Debug($"[NEWS FILTER] Entry blocked by Gemini analysis: {newsContext.Reasoning}");
                return null; // Block entry due to high-impact news
            }

            // CRITICAL FIX (Oct 25): Validate ICT sequence before allowing entries
            if (_htfSystemEnabled && _biasStateMachine != null)
            {
                // Only allow entries when ICT sequence is complete
                if (!_biasStateMachine.IsEntryAllowed())
                {
                    if (_config.EnableDebugLogging)
                        _journal.Debug($"[ICT GATE] Entry blocked - State: {_biasStateMachine.GetState()} | Need: READY_FOR_ENTRY");
                    return null; // Block all entries until sequence complete
                }

                // Ensure direction matches HTF bias
                var htfBias = _biasStateMachine.GetConfirmedBias();
                if (htfBias.HasValue && htfBias.Value != bias)
                {
                    if (_config.EnableDebugLogging)
                        _journal.Debug($"[ICT GATE] Entry blocked - Direction mismatch | HTF: {htfBias.Value} vs Entry: {bias}");
                    return null; // Block entries against HTF bias
                }
            }

            // ═══════════════════════════════════════════════════════════════════
            // PHASE 3: SMT CORRELATION FILTER
            // ═══════════════════════════════════════════════════════════════════
            if (_config.EnableSMT && _config.SMT_AsFilter && !string.IsNullOrWhiteSpace(_config.SMT_CompareSymbol))
            {
                bool? smtDirection = ComputeSmtSignal(_config.SMT_CompareSymbol, _config.SMT_TimeFrame, _config.SMT_Pivot);
                _currentSmtDirection = smtDirection; // Store for unified confidence

                if (smtDirection.HasValue)
                {
                    // SMT returns: true = bullish, false = bearish, null = no divergence
                    bool smtConflict = (bias == BiasDirection.Bullish && smtDirection.Value == false) ||
                                       (bias == BiasDirection.Bearish && smtDirection.Value == true);

                    if (smtConflict)
                    {
                        if (_config.EnableDebugLogging)
                            _journal.Debug($"[SMT FILTER] Entry BLOCKED - Divergence conflict | Signal: {bias} vs SMT: {(smtDirection.Value ? "Bullish" : "Bearish")} ({_config.SMT_CompareSymbol})");
                        return null; // Block entry due to SMT divergence
                    }

                    if (_config.EnableDebugLogging)
                        _journal.Debug($"[SMT FILTER] Entry CONFIRMED - SMT aligned | Signal: {bias}, SMT: {(smtDirection.Value ? "Bullish" : "Bearish")}");
                }
                else
                {
                    // No divergence detected - neutral (allow entry)
                    if (_config.EnableDebugLogging)
                        _journal.Debug($"[SMT FILTER] Entry ALLOWED - No divergence detected (neutral)");
                }
            }

            // OCT 28 QUICK WIN OPTIMIZATIONS (ADJUSTED): Filters too strict, relaxing time filters
            // Original filters blocked 100% of trades (all signals at 20-22 UTC, but filters allowed only 08-12 UTC)
            // Keeping only Quick Win #2 (Strong MSS) and Quick Win #5 (PDH/PDL priority)

            /* OCT 28 DISABLED - Time filters too strict (blocked all 17 trades)
            // QUICK WIN #1: London Session Only (08:00-12:00 UTC) - DISABLED
            // All signals happened at 20-22 UTC (NY close), not London session
            string currentSession = GetCurrentSession();
            int hour = Server.Time.Hour;
            if (!(hour >= 8 && hour < 12))
            {
                if (_config.EnableDebugLogging)
                    _journal.Debug($"[QUICK WIN #1] Session filter: hour={hour} (need 08:00-12:00 UTC) → SKIP");
                return null;
            }

            // QUICK WIN #3: Skip Asia Session (00:00-08:00 UTC) - DISABLED
            // Not needed - no signals during Asia anyway
            if (hour >= 0 && hour < 8)
            {
                if (_config.EnableDebugLogging)
                    _journal.Debug($"[QUICK WIN #3] Asia session filter: hour={hour} (skipping Asia) → SKIP");
                return null;
            }

            // QUICK WIN #4: Time-of-Day Filter (08:00-10:00 and 13:00-15:00 UTC) - DISABLED
            // Blocked all signals (they occur at 20-22 UTC)
            bool inOptimalTimeWindow = (hour >= 8 && hour < 10) || (hour >= 13 && hour < 15);
            if (!inOptimalTimeWindow)
            {
                if (_config.EnableDebugLogging)
                    _journal.Debug($"[QUICK WIN #4] Time-of-day filter: hour={hour} (need 08:00-10:00 or 13:00-15:00 UTC) → SKIP");
                return null;
            }
            */ // END DISABLED TIME FILTERS

            // QUICK WIN #2: Strong MSS Requirement (>0.25 ATR displacement) - ACTIVE
            // Weak MSS often fail to reach targets; strong displacement = commitment
            if (_state.ActiveMSS != null && mssSignals != null && mssSignals.Count > 0)
            {
                var lastMssSignal = mssSignals.LastOrDefault();
                if (lastMssSignal != null)
                {
                    // Calculate MSS displacement
                    double mssHigh = Math.Max(lastMssSignal.ImpulseStart, lastMssSignal.ImpulseEnd);
                    double mssLow = Math.Min(lastMssSignal.ImpulseStart, lastMssSignal.ImpulseEnd);
                    double mssRangePips = (mssHigh - mssLow) / Symbol.PipSize;

                    // Estimate ATR displacement (simple approximation)
                    double estimatedATRPips = 10.0; // M5 EURUSD typical ATR ~8-12 pips
                    double displacement = mssRangePips / estimatedATRPips;

                    if (displacement < 0.25)
                    {
                        if (_config.EnableDebugLogging)
                            _journal.Debug($"[QUICK WIN #2] Weak MSS filter: displacement={displacement:F2} ATR (need >0.25) | range={mssRangePips:F1}pips → SKIP");
                        return null;
                    }
                }
            }

            // QUICK WIN #5: PDH/PDL Sweep Priority - Expected +3-5pp WR
            // PDH/PDL sweeps have higher win rate than EQH/EQL sweeps
            if (sweeps != null && sweeps.Count > 0)
            {
                // Check if we have PDH/PDL sweeps (check Label field)
                bool hasPDHPDLSweep = sweeps.Any(s =>
                    s.Label != null && (s.Label.Contains("PDH") || s.Label.Contains("PDL")));

                // If we only have EQH/EQL sweeps (no PDH/PDL), be more selective
                bool hasOnlyEQHEQL = sweeps.All(s =>
                    s.Label != null && (s.Label.Contains("EQH") || s.Label.Contains("EQL")));

                if (hasOnlyEQHEQL && !hasPDHPDLSweep)
                {
                    // Allow EQH/EQL sweeps but only during optimal time windows (already filtered above)
                    if (_config.EnableDebugLogging)
                        _journal.Debug($"[QUICK WIN #5] Sweep priority: EQH/EQL only (no PDH/PDL) - Allowed but suboptimal");
                }
                else if (hasPDHPDLSweep)
                {
                    if (_config.EnableDebugLogging)
                        _journal.Debug($"[QUICK WIN #5] Sweep priority: PDH/PDL sweep detected ✅ - High priority setup");
                }
            }

            double pip = Symbol.PipSize;
            double mid = (Symbol.Bid + Symbol.Ask) * 0.5;

            // NEW: Adaptive OTE tolerance (ATR-based if enabled)
            double tol = pip * (_config?.TapTolerancePips ?? 1.0); // default tolerance
            if (_cfg != null && _cfg.oteAdaptive != null && _cfg.oteAdaptive.enabled)
            {
                // Calculate ATR-based tolerance
                var atrConfig = _cfg.oteAdaptive.@base;
                if (atrConfig.mode == "atr")
                {
                    var atrIndicator = Indicators.AverageTrueRange(atrConfig.period, MovingAverageType.Simple);
                    double atrValue = atrIndicator.Result.LastValue;
                    double atrPips = atrValue / pip;
                    double calculatedTolPips = atrPips * atrConfig.multiplier;

                    // Apply bounds
                    double minBound = atrConfig.bounds.Count > 0 ? atrConfig.bounds[0] : 0.9;
                    double maxBound = atrConfig.bounds.Count > 1 ? atrConfig.bounds[1] : 1.8;
                    calculatedTolPips = Math.Max(minBound, Math.Min(maxBound, calculatedTolPips));

                    // Round to specified precision
                    calculatedTolPips = Math.Round(calculatedTolPips / atrConfig.roundTo) * atrConfig.roundTo;

                    tol = pip * calculatedTolPips;

                    if (_config.EnableDebugLogging && Bars.Count % 20 == 0)
                        _journal.Debug($"[OTE ADAPTIVE] ATR={atrPips:F2}pips × {atrConfig.multiplier:F2} = {calculatedTolPips:F2}pips (bounds [{minBound:F1}, {maxBound:F1}])");
                }
            }

            double tolOverlap = pip * Math.Max(0.0, _config?.DualTapOverlapPips ?? 0.0);

            // 0) Latest MSS direction (fallback = bias)
            // MSS LIFECYCLE: Use locked MSS regardless of IsValid flag (new system overrides old validation)
            MSSSignal lastMss = null;
            if (_state.ActiveMSS != null)
            {
                // Use locked MSS from lifecycle (bypass old IsValid check)
                lastMss = _state.ActiveMSS;
                if (_config.EnableDebugLogging && Bars.Count % 10 == 0)
                    _journal.Debug($"BuildSignal: Using LOCKED MSS (bypassing IsValid check) | Dir={lastMss.Direction}");
            }
            else
            {
                // Fallback to old validation system when lifecycle not active
                lastMss = (mssSignals ?? new List<MSSSignal>()).LastOrDefault(s => s.IsValid);
            }
            // Fix entryDir=Neutral issue: Use MSS direction when available and not Neutral
            var entryDir = (lastMss != null && lastMss.Direction != BiasDirection.Neutral)
                ? lastMss.Direction
                : bias;

            // If still Neutral, use most recent valid MSS direction
            if (entryDir == BiasDirection.Neutral && mssSignals != null)
            {
                var recentValidMss = mssSignals.LastOrDefault(s => s.IsValid && s.Direction != BiasDirection.Neutral);
                if (recentValidMss != null)
                {
                    entryDir = recentValidMss.Direction;
                    if (_config.EnableDebugLogging)
                        _journal.Debug($"BuildSignal: HTF bias Neutral, using recent MSS direction: {entryDir}");
                }
            }

            // If HTF system enabled and still Neutral, prefer confirmed bias
            if (_htfSystemEnabled && _biasStateMachine != null && entryDir == BiasDirection.Neutral)
            {
                var confirmedBias = _biasStateMachine.GetConfirmedBias();
                if (confirmedBias.HasValue)
                {
                    entryDir = confirmedBias.Value;
                    if (_config.EnableDebugLogging)
                        _journal.Debug($"BuildSignal: Using HTF confirmed bias: {entryDir}");
                }
            }

            if (_config.EnableDebugLogging)
                _journal.Debug($"BuildSignal: bias={bias} mssDir={lastMss?.Direction} entryDir={entryDir} (Neutral={entryDir == BiasDirection.Neutral}) bars={Bars?.Count} sweeps={(sweeps?.Count ?? 0)} mss={(mssSignals?.Count ?? 0)} validMss={mssSignals?.Count(s => s.IsValid)} ote={(oteZones?.Count ?? 0)} ob={(orderBlocks?.Count ?? 0)} fvg={(fvgZones?.Count ?? 0)} brk={(breakerBlocks?.Count ?? 0)}");

            // Cooldown guard
            if (_config.CooldownBarsAfterEntry > 0 && Bars != null && Bars.Count > 0)
            {
                int lastBar = Bars.Count - 1;
                if (lastBar - _state.LastEntryBarIndex < _config.CooldownBarsAfterEntry)
                {
                    if (_config.EnableDebugLogging) _journal.Debug($"Cooldown active: lastEntryBar={_state.LastEntryBarIndex} now={lastBar}");
                    return null;
                }
            }

            // Daily EQ50 (for side rule)
            double? pdEq = null;
            if (_drawer != null && _drawer.TryGetPrevDayLevels(out var _pdh, out var _pdl, out var _eq, out _))
                pdEq = _eq;

            // Helpers

            bool OteSideOk(OTEZone z)
            {
                // DISABLED: Old filters were blocking all OTE entries
                // Accept all OTE zones regardless of Daily EQ50 or swing discount/premium position
                return true;

                // DISABLED: Daily EQ50 side filter (was blocking entries)
                // var sideDir = lastMss?.Direction ?? BiasDirection.Neutral;
                // double lo = Math.Min(z.OTE618, z.OTE79);
                // double hi = Math.Max(z.OTE618, z.OTE79);
                // if (pdEq.HasValue && sideDir != BiasDirection.Neutral)
                // {
                //     if (sideDir == BiasDirection.Bullish && !(hi < pdEq.Value)) return false;
                //     if (sideDir == BiasDirection.Bearish && !(lo > pdEq.Value)) return false;
                // }

                // DISABLED: Swing discount/premium filter (was blocking entries)
                // if (_config.RequireSwingDiscountPremium && lastMss != null)
                // {
                //     double midSwing = (lastMss.ImpulseStart + lastMss.ImpulseEnd) * 0.5;
                //     if (sideDir == BiasDirection.Bullish && !(hi <= midSwing)) return false;
                //     if (sideDir == BiasDirection.Bearish && !(lo >= midSwing)) return false;
                // }
            }

            // Evaluate POIs by configured priority
            bool anyOtePresent = (oteZones != null && oteZones.Count > 0);
            bool oteTapped = false;
            // If OTE must always be tapped to enter at all, check first
            if (_config.RequireOteAlways && anyOtePresent)
            {
                var mustOte = oteZones?
                    .Where(z => z.Direction == entryDir && OteSideOk(z))
                    .FirstOrDefault(z => PriceTouchesZone(Math.Min(z.OTE618, z.OTE79), Math.Max(z.OTE618, z.OTE79), tol));
                if (mustOte == null) return null;
            }
            // OCT 26 CASCADE FIX: Enforce strict cascade BEFORE POI loop
            // If SequenceGate enabled and fallback DISABLED, validate cascade first
            if (_config.EnableSequenceGate && !_config.AllowSequenceGateFallback)
            {
                int swIdx, msIdx;
                bool cascadeOk = ValidateSequenceGate(entryDir, sweeps, mssSignals, out swIdx, out msIdx);

                if (!cascadeOk)
                {
                    int sweepCount = sweeps?.Count ?? 0;
                    int mssCount = mssSignals?.Count ?? 0;
                    int validMssCount = mssSignals?.Count(s => s.IsValid) ?? 0;

                    if (_config.EnableDebugLogging)
                        _journal.Debug($"CASCADE: SequenceGate=FALSE sweeps={sweepCount} mss={mssCount} validMss={validMssCount} entryDir={entryDir} → ABORT (no signal build)");

                    return null; // ABORT - No POI evaluation without proper cascade
                }

                if (_config.EnableDebugLogging)
                    _journal.Debug($"CASCADE: SequenceGate=TRUE sweeps={(sweeps?.Count ?? 0)}>0 mss={(mssSignals?.Count(s => s.IsValid) ?? 0)}>0 → PROCEED");
            }

            var poiKeys = _config.StrictOteAfterMssCompletion ? new[] { "OTE" } : (_config.PoiPriorityOrder ?? "OTE>FVG>OB>Breaker").Split('>');
            if (_config.EnableDebugLogging)
                _journal.Debug($"POI Loop: priority={string.Join(">", poiKeys)} | oteCount={oteZones?.Count ?? 0} | obCount={orderBlocks?.Count ?? 0} | fvgCount={fvgZones?.Count ?? 0}");
            foreach (var key in poiKeys)
            {
                var t = key.Trim().ToUpperInvariant();
                if (_config.EnableDebugLogging)
                    _journal.Debug($"POI: Checking {t}...");
                if (t == "OTE")
                {
                    int swIdxO, msIdxO;
                    var dirForOte = entryDir;
                    bool gateOk = true;
                    if (_config.EnableSequenceGate)
                    {
                        gateOk = ValidateSequenceGate(entryDir, sweeps, mssSignals, out swIdxO, out msIdxO);
                        if (!gateOk && _config.AllowSequenceGateFallback && lastMss != null)
                        {
                            // Use MSS direction for OTE on fallback path
                            dirForOte = lastMss.Direction;
                            gateOk = ValidateSequenceGate(dirForOte, sweeps, mssSignals, out swIdxO, out msIdxO);
                        }
                        if (!gateOk)
                        {
                            if (_config.EnableDebugLogging) _journal.Debug("OTE: sequence gate failed");
                            continue;
                        }
                    }
                    if (_config.EnableDebugLogging && oteZones != null)
                    {
                        int totalOte = oteZones.Count;
                        int dirMatch = oteZones.Count(z => z.Direction == dirForOte);
                        int sideOk = oteZones.Count(z => z.Direction == dirForOte && OteSideOk(z));
                        _journal.Debug($"OTE Filter: total={totalOte} dirMatch={dirMatch} (need={dirForOte}) sideOk={sideOk}");
                        if (sideOk == 0 && dirMatch > 0)
                        {
                            foreach (var z in oteZones.Where(z => z.Direction == dirForOte))
                            {
                                bool okResult = OteSideOk(z);
                                _journal.Debug($"OTE SideCheck: dir={z.Direction} box=[{Math.Min(z.OTE618, z.OTE79):F5},{Math.Max(z.OTE618, z.OTE79):F5}] sideOk={okResult}");
                            }
                        }
                    }
                    // MULTI-TF: OTE is calculated from mssBars (lower TF), so check taps using mssBars too
                    var mssBars = _state.MSSBars ?? Bars;
                    var activeOte = oteZones?
                        .Where(z => z.Direction == dirForOte && OteSideOk(z))
                        .OrderBy(z =>
                        {
                            double lo = Math.Min(z.OTE618, z.OTE79);
                            double hi = Math.Max(z.OTE618, z.OTE79);
                            double midBand = (lo + hi) * 0.5;
                            return Math.Abs(mid - midBand);
                        })
                        .FirstOrDefault(z =>
                        {
                            bool tapped = PriceTouchesZone(Math.Min(z.OTE618, z.OTE79), Math.Max(z.OTE618, z.OTE79), tol, mssBars);
                            if (_config.EnableDebugLogging && !tapped)
                            {
                                double lo = Math.Min(z.OTE618, z.OTE79);
                                double hi = Math.Max(z.OTE618, z.OTE79);
                                double mssMid = mssBars != null && mssBars.Count > 0 ? (mssBars.ClosePrices.LastValue) : mid;
                                _journal.Debug($"OTE: NOT tapped | box=[{lo:F5},{hi:F5}] chartMid={mid:F5} mssMid={mssMid:F5} tol={tol/Symbol.PipSize:F2}pips");
                            }
                            if (!tapped) return false;
                            if (_config.RequirePOIKeyLevelInteraction)
                            {
                                double lo = Math.Min(z.OTE618, z.OTE79);
                                double hi = Math.Max(z.OTE618, z.OTE79);
                                if (!ZoneTouchesKeyLevels(lo, hi, _config.KeyLevelInteractionPips * pip))
                                {
                                    if (_config.EnableDebugLogging) _journal.Debug($"OTE: tapped but doesn't touch key levels | box=[{lo:F5},{hi:F5}]");
                                    return false;
                                }
                            }
                            return true;
                        });

                    if (activeOte != null)
                    {
                        if (_config.EnableDebugLogging) _journal.Debug($"OTE: tapped dir={activeOte.Direction} box=[{Math.Min(activeOte.OTE618, activeOte.OTE79):F5},{Math.Max(activeOte.OTE618, activeOte.OTE79):F5}] mid={mid:F5}");

                        // PHASE 1A: RECORD OTE TAP FOR ADAPTIVE LEARNING
                        if (_learningEngine != null && _config.EnableAdaptiveLearning)
                        {
                            double fibLevel = 0.618; // Determine actual fib level if possible
                            double zoneTop = Math.Max(activeOte.OTE618, activeOte.OTE79);
                            double zoneBottom = Math.Min(activeOte.OTE618, activeOte.OTE79);
                            double tapPrice = mid;
                            double bufferPips = tol / Symbol.PipSize;
                            bool entryExecuted = false; // Will be updated when entry is actually executed

                            _learningEngine.RecordOteTap(fibLevel, zoneTop, zoneBottom, tapPrice, bufferPips, entryExecuted);
                        }

                        // HUD marker when key-level validity is enabled
                        if (_config.RequirePOIKeyLevelInteraction && _drawer != null)
                        {
                            double loB = Math.Min(activeOte.OTE618, activeOte.OTE79);
                            double hiB = Math.Max(activeOte.OTE618, activeOte.OTE79);
                            bool overl = ZoneTouchesKeyLevels(loB, hiB, _config.KeyLevelInteractionPips * pip);
                            if (overl)
                            {
                                _drawer.MarkPoiValidation(Server.Time, loB, hiB, "OTE", true);
                                _drawer.DrawOBBox(Server.Time, loB, hiB, 15, "POI_OK", Color.FromArgb(30, 0, 200, 0));
                            }
                        }
                        // Dual-tap enforcement when both OTE and selected POI exist
                        if (_config.RequireDualTap)
                        {
                            bool poiExists = false;
                            bool overlapTapped = false;

                            if (_config.DualTapPair == DualTapPairEnum.OTE_OB)
                            {
                                var dirObs = (orderBlocks ?? new List<OrderBlock>()).Where(ob => ob.Direction == entryDir).ToList();
                                poiExists = dirObs.Any();
                                foreach (var ob in dirObs)
                                {
                                    if (TryOverlap(activeOte.Low, activeOte.High, Math.Min(ob.LowPrice, ob.HighPrice), Math.Max(ob.LowPrice, ob.HighPrice), tolOverlap, out var oLo, out var oHi))
                                    {
                                        if (PriceTouchesZone(oLo, oHi, tol)) { overlapTapped = true; break; }
                                    }
                                }
                            }
                            else if (_config.DualTapPair == DualTapPairEnum.OTE_Breaker)
                            {
                                var dirBrks = (breakerBlocks ?? new List<BreakerBlock>()).Where(b => b.Direction == entryDir).ToList();
                                poiExists = dirBrks.Any();
                                foreach (var b in dirBrks)
                                {
                                    if (TryOverlap(activeOte.Low, activeOte.High, Math.Min(b.LowPrice, b.HighPrice), Math.Max(b.LowPrice, b.HighPrice), tolOverlap, out var oLo, out var oHi))
                                    {
                                        if (PriceTouchesZone(oLo, oHi, tol)) { overlapTapped = true; break; }
                                    }
                                }
                            }
                            else if (_config.DualTapPair == DualTapPairEnum.OTE_FVG)
                            {
                                var dirFvg = (fvgZones ?? new List<FVGZone>()).Where(f => f.Direction == entryDir).ToList();
                                poiExists = dirFvg.Any();
                                foreach (var f in dirFvg)
                                {
                                    if (TryOverlap(activeOte.Low, activeOte.High, Math.Min(f.Low, f.High), Math.Max(f.Low, f.High), tolOverlap, out var oLo, out var oHi))
                                    {
                                        if (PriceTouchesZone(oLo, oHi, tol)) { overlapTapped = true; break; }
                                    }
                                }
                            }

                            // If the paired POI exists, require overlap tap; if it doesn't exist, allow OTE alone
                            if (poiExists && !overlapTapped)
                            {
                                if (_config.EnableDebugLogging) _journal.Debug("OTE: dual-tap required but overlap not tapped");
                                return null;
                            }
                        }

                        var dir = activeOte.Direction;
                        double lo = Math.Min(activeOte.OTE618, activeOte.OTE79);
                        double hi = Math.Max(activeOte.OTE618, activeOte.OTE79);

                        // PHASE 1B: ADAPTIVE SCORING FILTER FOR OTE
                        if (_learningEngine != null && _config.EnableAdaptiveLearning && _config.UseAdaptiveScoring)
                        {
                            double fibLevel = 0.618; // Determine actual fib level from activeOte if possible
                            double bufferPips = tol / Symbol.PipSize;
                            double oteConfidence = _learningEngine.CalculateOteConfidence(fibLevel, bufferPips);

                            if (oteConfidence < _config.AdaptiveConfidenceThreshold)
                            {
                                if (_config.EnableDebugLogging)
                                    _journal.Debug($"[ADAPTIVE FILTER] OTE rejected: Confidence {oteConfidence:F2} < {_config.AdaptiveConfidenceThreshold:F2}");
                                continue; // Skip this OTE zone - low confidence
                            }

                            if (_config.EnableDebugLogging)
                                _journal.Debug($"[ADAPTIVE FILTER] OTE passed: Confidence {oteConfidence:F2} >= {_config.AdaptiveConfidenceThreshold:F2}");
                        }

                        // ADVANCED FEATURE: PULLBACK QUALITY GATE - Analyze pullback character
                        if (_priceActionAnalyzer != null && _state.ActiveMSS != null)
                        {
                            // Analyze pullback from MSS break to current OTE touch
                            _currentPullbackQuality = _priceActionAnalyzer.AnalyzePullback(_state.ActiveMSSTime, Server.Time, dir);

                            if (_config.EnableDebugLogging)
                            {
                                _journal.Debug($"[PRICE ACTION] Pullback Quality: {_currentPullbackQuality.Quality} | Strength: {_currentPullbackQuality.StrengthScore:F2}");
                                _journal.Debug($"[PRICE ACTION] {_currentPullbackQuality.Reasoning}");
                            }

                            // Filter impulsive pullbacks (too strong against trade direction)
                            if (_currentPullbackQuality.Quality == PriceActionAnalyzer.MoveQuality.Impulsive ||
                                _currentPullbackQuality.Quality == PriceActionAnalyzer.MoveQuality.StrongImpulsive)
                            {
                                if (_config.EnableDebugLogging)
                                    _journal.Debug($"[PRICE ACTION GATE] OTE rejected: Impulsive pullback (may continue against trade direction)");
                                continue; // Skip - pullback too strong
                            }
                        }

                        if (!IsPullbackTap(dir, lo, hi)) { if (_config.EnableDebugLogging) _journal.Debug("OTE: pullback gate blocked"); continue; }
                        double entry = (dir == BiasDirection.Bullish) ? Symbol.Ask : Symbol.Bid;
                        double stop;

                        // NEW LOGIC: Stop loss at sweep candle high/low + buffer
                        // - BUY entry (bullish MSS from EQL swept): Stop below sweep candle low
                        // - SELL entry (bearish MSS from EQH swept): Stop above sweep candle high
                        if (_state.ActiveSweep != null)
                        {
                            // ═══════════════════════════════════════════════════════════════
                            // PHASE 1B CHANGE #2: Session-Aware OTE Buffer (Sweep Candle SL)
                            // ═══════════════════════════════════════════════════════════════
                            double sessionBuffer = _config.GetSessionAwareOTEBuffer(Server.TimeInUtc);

                            stop = (dir == BiasDirection.Bullish)
                                ? (_state.ActiveSweep.SweepCandleLow - sessionBuffer * pip)
                                : (_state.ActiveSweep.SweepCandleHigh + sessionBuffer * pip);
                        }
                        else if (_config.StopUseFOIEdge)
                        {
                            // ═══════════════════════════════════════════════════════════════
                            // PHASE 1B CHANGE #2: Session-Aware OTE Buffer
                            // ═══════════════════════════════════════════════════════════════
                            double sessionBuffer = _config.GetSessionAwareOTEBuffer(Server.TimeInUtc);

                            if (_config.EnableDebugLogging && sessionBuffer != _config.StopBufferPipsOTE)
                                _journal.Debug($"[OTE_GATE] Session-aware buffer: {sessionBuffer:F1} pips (UTC hour {Server.TimeInUtc.Hour}) vs default {_config.StopBufferPipsOTE:F1}");

                            // FALLBACK: Use locked MSS for stop calculation (bypass IsValid check)
                            var lastMssStop = _state.ActiveMSS != null && _state.ActiveMSS.FOIRange.HasValue
                                ? _state.ActiveMSS
                                : (mssSignals ?? new List<MSSSignal>()).LastOrDefault(s => s.IsValid && s.FOIRange.HasValue);
                            if (lastMssStop != null)
                            {
                                double foiLo = lastMssStop.FOIRange.Value.low;
                                double foiHi = lastMssStop.FOIRange.Value.high;
                                stop = (dir == BiasDirection.Bullish) ? (foiLo - sessionBuffer * pip) : (foiHi + sessionBuffer * pip);
                            }
                            else stop = (dir == BiasDirection.Bullish) ? (lo - sessionBuffer * pip) : (hi + sessionBuffer * pip);
                        }
                        else
                        {
                            // ═══════════════════════════════════════════════════════════════
                            // PHASE 1B CHANGE #2: Session-Aware OTE Buffer
                            // ═══════════════════════════════════════════════════════════════
                            double sessionBuffer = _config.GetSessionAwareOTEBuffer(Server.TimeInUtc);

                            if (_config.EnableDebugLogging && sessionBuffer != _config.StopBufferPipsOTE)
                                _journal.Debug($"[OTE_GATE] Session-aware buffer: {sessionBuffer:F1} pips (UTC hour {Server.TimeInUtc.Hour}) vs default {_config.StopBufferPipsOTE:F1}");

                            stop = (dir == BiasDirection.Bullish) ? (lo - sessionBuffer * pip) : (hi + sessionBuffer * pip);
                        }
                        if (dir == BiasDirection.Bullish && stop >= entry) stop = entry - 10 * pip;
                        if (dir == BiasDirection.Bearish && stop <= entry) stop = entry + 10 * pip;
                        double raw = Math.Abs(entry - stop) / pip;
                        if (raw < _config.MinStopPipsClamp)
                            stop = (entry > stop) ? entry - _config.MinStopPipsClamp * pip : entry + _config.MinStopPipsClamp * pip;
                        oteTapped = true;
                        if (_config.RequireMicroBreak && !ConfirmBreak(dir))
                        { if (_config.EnableDebugLogging) _journal.Debug("OTE: micro-break gate blocked"); continue; }

                        // BEARISH ENTRY BLOCK REMOVED (Oct 26, 2025)
                        // Previous issue: All bearish entries blocked due to historical 100% loss rate
                        // Root cause was MSS opposite liquidity direction bug (FIXED in CRITICAL_BUG_FIX_OPPOSITE_LIQUIDITY.md)
                        // Bearish MSS now correctly targets Demand BELOW (not Supply above)
                        // Re-enabling bearish entries to allow both directions

                        // OCT 28 EMERGENCY FIX: DISABLED - This gate was causing 40pp WR drop (47% → 7.5%)
                        // GATE: Require MSS opposite liquidity to be set (prevents low-RR random liquidity targets)
                        // if (_state.OppositeLiquidityLevel <= 0)
                        // {
                        //     if (_config.EnableDebugLogging)
                        //         _journal.Debug($"OTE: No MSS opposite liquidity set (OppLiq={_state.OppositeLiquidityLevel:F5}) → Skipping to avoid low-RR targets");
                        //     continue;
                        // }

                        double? tpPriceO = null;
                        if (_config.UseOppositeLiquidityTP)
                        {
                            double rawStopPips = Math.Abs(entry - stop) / pip;
                            var opp = FindOppositeLiquidityTargetWithMinRR(dir == BiasDirection.Bullish, entry, rawStopPips, _config.MinRiskReward);
                            if (opp.HasValue)
                            {
                                double spreadPipsNow = Symbol.Spread / pip;
                                if (_config.SpreadCushionUseAvg && _state.SpreadPips.Count > 0)
                                {
                                    double sum = 0; foreach (var v in _state.SpreadPips) sum += v; spreadPipsNow = sum / _state.SpreadPips.Count;
                                }
                                double cushion = _config.EnableTpSpreadCushion ? Math.Max(spreadPipsNow, _config.SpreadCushionExtraPips) : _config.SpreadCushionExtraPips;
                                tpPriceO = (dir == BiasDirection.Bullish) ? (opp.Value - (_config.TpOffsetPips + cushion) * pip)
                                                                          : (opp.Value + (_config.TpOffsetPips + cushion) * pip);
                            }
                        }
                        // CRITICAL FIX (Oct 23, 2025): REJECT TRADES WITH NO VALID TP
                        // Sept 9-11 backtest showed TP=0.00000 forcing 1:1 RR fallback → 100% loss rate
                        // If no valid TP target found, REJECT the trade instead of using poor fallback
                        if (!tpPriceO.HasValue || tpPriceO.Value == 0)
                        {
                            if (_config.EnableDebugLogging)
                                _journal.Debug($"OTE: ENTRY REJECTED → No valid TP target found (TP={tpPriceO?.ToString("F5") ?? "null"}). Prevents low-RR trades.");
                            continue;
                        }

                        // Calculate actual RR and enforce minimum
                        double actualRR = Math.Abs(tpPriceO.Value - entry) / Math.Max(1e-6, Math.Abs(entry - stop));
                        if (actualRR < _config.MinRiskReward)
                        {
                            if (_config.EnableDebugLogging)
                                _journal.Debug($"OTE: ENTRY REJECTED → RR too low ({actualRR:F2} < {_config.MinRiskReward:F2})");
                            continue;
                        }

                        var tsO = new TradeSignal { Direction = dir, EntryPrice = entry, StopLoss = stop, TakeProfit = tpPriceO.Value, Timestamp = Server.Time, OTEZone = activeOte };
                        if (_config.EnableDebugLogging)
                        {
                            double rrO = 0;
                            if (tpPriceO.HasValue) rrO = Math.Abs(tpPriceO.Value - entry) / Math.Max(1e-6, Math.Abs(entry - stop));
                            _journal.Debug($"OTE Signal: entry={entry:F5} stop={stop:F5} tp={tpPriceO?.ToString("F5") ?? "fallback"} | RR={rrO:F2}");
                        }
                        if (_config.EnableDebugLogging)
                            _journal.Debug($"ENTRY OTE: dir={dir} entry={entry:F5} stop={stop:F5}");
                        _state.LastOteLo = lo; _state.LastOteHi = hi; _state.LastEntryDir = dir;

                        // Apply phase-based logic (Phase 3 for OTE entries)
                        return ApplyPhaseLogic(tsO, "OTE");
                    }
                }
                else if (t == "FVG")
                {
                    if (_config.RequireOteIfAvailable && anyOtePresent && !oteTapped) continue;
                    int swIdx, msIdx;
                    if (_config.EnableSequenceGate && !ValidateSequenceGate(entryDir, sweeps, mssSignals, out swIdx, out msIdx)) { if (_config.EnableDebugLogging) _journal.Debug("FVG: sequence gate failed"); continue; }
                    // REMOVED: OTE-only restriction when sequence fallback is used - FVG can produce quality 1:3 RR signals even with 200-400 bar lookback
                    var activeFvg = (fvgZones ?? new List<FVGZone>())
                        .Where(z => z.Direction == entryDir)
                        .OrderBy(z => Math.Abs(mid - ((z.Low + z.High) * 0.5)))
                        .FirstOrDefault(z => PriceTouchesZone(z.Low, z.High, tol));
                    if (activeFvg != null)
                    {
                        if (_config.RequireDualTap && _config.DualTapPair == DualTapPairEnum.OTE_FVG)
                        {
                            bool oteExist = (oteZones ?? new List<OTEZone>()).Any(z => z.Direction == entryDir);
                            bool overlapTapped = false;
                            if (oteExist)
                            {
                                foreach (var z in (oteZones ?? new List<OTEZone>()).Where(z => z.Direction == entryDir))
                                {
                                    if (TryOverlap(z.Low, z.High, Math.Min(activeFvg.Low, activeFvg.High), Math.Max(activeFvg.Low, activeFvg.High), tolOverlap, out var oLo, out var oHi))
                                    {
                                        if (PriceTouchesZone(oLo, oHi, tol)) { overlapTapped = true; break; }
                                    }
                                }
                            if (!overlapTapped) { if (_config.EnableDebugLogging) _journal.Debug("FVG: dual-tap required but overlap not tapped"); return null; } // require overlap tap when both exist
                            }
                        }
                        var dir = activeFvg.Direction;
                        double lo = Math.Min(activeFvg.Low, activeFvg.High);
                        double hi = Math.Max(activeFvg.Low, activeFvg.High);
                        if (!IsPullbackTap(dir, lo, hi)) { if (_config.EnableDebugLogging) _journal.Debug("FVG: pullback gate blocked"); continue; }
                        double entry = (dir == BiasDirection.Bullish) ? Symbol.Ask : Symbol.Bid;
                        double stop;
                        if (_config.StopUseFOIEdge)
                        {
                            // MSS LIFECYCLE: Use locked MSS for stop calculation (bypass IsValid check)
                            var lastMssStop = _state.ActiveMSS != null && _state.ActiveMSS.FOIRange.HasValue
                                ? _state.ActiveMSS
                                : (mssSignals ?? new List<MSSSignal>()).LastOrDefault(s => s.IsValid && s.FOIRange.HasValue);
                            if (lastMssStop != null)
                            {
                                double foiLo = lastMssStop.FOIRange.Value.low;
                                double foiHi = lastMssStop.FOIRange.Value.high;
                                stop = (dir == BiasDirection.Bullish) ? (foiLo - _config.StopBufferPipsFVG * pip) : (foiHi + _config.StopBufferPipsFVG * pip);
                            }
                            else stop = (dir == BiasDirection.Bullish) ? (lo - _config.StopBufferPipsFVG * pip) : (hi + _config.StopBufferPipsFVG * pip);
                        }
                        else
                        {
                            stop = (dir == BiasDirection.Bullish) ? (lo - _config.StopBufferPipsFVG * pip) : (hi + _config.StopBufferPipsFVG * pip);
                        }
                        if (dir == BiasDirection.Bullish && stop >= entry) stop = entry - 10 * pip;
                        if (dir == BiasDirection.Bearish && stop <= entry) stop = entry + 10 * pip;
                        double raw = Math.Abs(entry - stop) / pip;
                        if (raw < _config.MinStopPipsClamp)
                            stop = (entry > stop) ? entry - _config.MinStopPipsClamp * pip : entry + _config.MinStopPipsClamp * pip;
                        if (_config.RequireMicroBreak && !ConfirmBreak(dir)) { if (_config.EnableDebugLogging) _journal.Debug("FVG: micro-break gate blocked"); continue; }

                        // OCT 28 EMERGENCY FIX: DISABLED - This gate was causing 40pp WR drop (47% → 7.5%)
                        // GATE: Require MSS opposite liquidity to be set (prevents low-RR random liquidity targets)
                        // if (_state.OppositeLiquidityLevel <= 0)
                        // {
                        //     if (_config.EnableDebugLogging)
                        //         _journal.Debug($"FVG: No MSS opposite liquidity set (OppLiq={_state.OppositeLiquidityLevel:F5}) → Skipping to avoid low-RR targets");
                        //     continue;
                        // }

                        double? tpPriceF = null;
                        if (_config.UseOppositeLiquidityTP)
                        {
                            double rawStopPips = Math.Abs(entry - stop) / pip;
                            var opp = FindOppositeLiquidityTargetWithMinRR(dir == BiasDirection.Bullish, entry, rawStopPips, _config.MinRiskReward);
                            if (opp.HasValue)
                            {
                                double spreadPipsNow = Symbol.Spread / pip;
                                if (_config.SpreadCushionUseAvg && _state.SpreadPips.Count > 0)
                                {
                                    double sum = 0; foreach (var v in _state.SpreadPips) sum += v; spreadPipsNow = sum / _state.SpreadPips.Count;
                                }
                                double cushion = _config.EnableTpSpreadCushion ? Math.Max(spreadPipsNow, _config.SpreadCushionExtraPips) : _config.SpreadCushionExtraPips;
                                tpPriceF = (dir == BiasDirection.Bullish) ? (opp.Value - (_config.TpOffsetPips + cushion) * pip)
                                                                          : (opp.Value + (_config.TpOffsetPips + cushion) * pip);
                            }
                        }
                        var tsF = new TradeSignal { Direction = dir, EntryPrice = entry, StopLoss = stop, TakeProfit = tpPriceF ?? 0, Timestamp = Server.Time };
                        // Min RR filter - REMOVED: Let TradeManager's ChooseTakeProfit calculate fallback TP
                        if (_config.EnableDebugLogging)
                        {
                            double rrF = 0; if (tpPriceF.HasValue) rrF = Math.Abs(tpPriceF.Value - entry) / Math.Max(1e-6, Math.Abs(entry - stop));
                            _journal.Debug($"FVG Signal: entry={entry:F5} stop={stop:F5} tp={tpPriceF?.ToString("F5") ?? "fallback"} | RR={rrF:F2}");
                        }
                        if (_config.EnableDebugLogging) _journal.Debug($"ENTRY FVG: dir={dir} entry={entry:F5} stop={stop:F5}");

                        // Apply phase-based logic (Phase 1 for FVG entries)
                        return ApplyPhaseLogic(tsF, "FVG");
                    }
                }
                else if (t == "OB")
                {
                    if (_config.RequireOteIfAvailable && anyOtePresent && !oteTapped) continue;
                    int swIdxOb, msIdxOb;
                    if (_config.EnableSequenceGate && !ValidateSequenceGate(entryDir, sweeps, mssSignals, out swIdxOb, out msIdxOb)) { if (_config.EnableDebugLogging) _journal.Debug("OB: sequence gate failed"); continue; }
                    // REMOVED: OTE-only restriction when sequence fallback is used - OrderBlock can produce quality 1:3 RR signals even with 200-400 bar lookback
                    var activeOb = orderBlocks?
                        .Where(ob => ob.Direction == entryDir)
                        .Where(ob => {
                            if (!_config.RequireSwingDiscountPremium || lastMss == null) return true;
                            double loOb = Math.Min(ob.LowPrice, ob.HighPrice);
                            double hiOb = Math.Max(ob.LowPrice, ob.HighPrice);
                            double midSwing = (lastMss.ImpulseStart + lastMss.ImpulseEnd) * 0.5;
                            if (entryDir == BiasDirection.Bullish) return hiOb <= midSwing; // demand in discount
                            else return loOb >= midSwing; // supply in premium
                        })
                        .OrderBy(ob => Math.Abs(mid - ((Math.Min(ob.LowPrice, ob.HighPrice) + Math.Max(ob.LowPrice, ob.HighPrice)) * 0.5)))
                        .FirstOrDefault(ob =>
                        {
                            bool tapped = PriceTouchesZone(ob.LowPrice, ob.HighPrice, tol);
                            if (!tapped) return false;
                            if (_config.RequirePOIKeyLevelInteraction)
                            {
                                double lo = Math.Min(ob.LowPrice, ob.HighPrice);
                                double hi = Math.Max(ob.LowPrice, ob.HighPrice);
                                if (!ZoneTouchesKeyLevels(lo, hi, _config.KeyLevelInteractionPips * pip)) return false;
                            }
                            return true;
                        });
                    if (activeOb != null)
                    {
                        if (_config.RequirePOIKeyLevelInteraction && _drawer != null)
                        {
                            double loB = Math.Min(activeOb.LowPrice, activeOb.HighPrice);
                            double hiB = Math.Max(activeOb.LowPrice, activeOb.HighPrice);
                            bool overl = ZoneTouchesKeyLevels(loB, hiB, _config.KeyLevelInteractionPips * pip);
                            if (overl)
                            {
                                _drawer.MarkPoiValidation(Server.Time, loB, hiB, "OB", true);
                                _drawer.DrawOBBox(Server.Time, loB, hiB, 15, "POI_OK", Color.FromArgb(30, 0, 200, 0));
                            }
                        }
                        if (_config.RequireDualTap && _config.DualTapPair == DualTapPairEnum.OTE_OB)
                        {
                            bool oteExist = (oteZones ?? new List<OTEZone>()).Any(z => z.Direction == entryDir);
                            bool overlapTapped = false;
                            if (oteExist)
                            {
                                foreach (var z in (oteZones ?? new List<OTEZone>()).Where(z => z.Direction == entryDir))
                                {
                                    if (TryOverlap(z.Low, z.High, Math.Min(activeOb.LowPrice, activeOb.HighPrice), Math.Max(activeOb.LowPrice, activeOb.HighPrice), tolOverlap, out var oLo, out var oHi))
                                    {
                                        if (PriceTouchesZone(oLo, oHi, tol)) { overlapTapped = true; break; }
                                    }
                                }
                                if (!overlapTapped) { if (_config.EnableDebugLogging) _journal.Debug("OB: dual-tap required but overlap not tapped"); return null; } // require overlap tap when both exist
                            }
                        }
                        var dir = activeOb.Direction;
                        double lo = Math.Min(activeOb.LowPrice, activeOb.HighPrice);
                        double hi = Math.Max(activeOb.LowPrice, activeOb.HighPrice);
                        if (!IsPullbackTap(dir, lo, hi)) { if (_config.EnableDebugLogging) _journal.Debug("OB: pullback gate blocked"); continue; }
                        double entry = (dir == BiasDirection.Bullish) ? Symbol.Ask : Symbol.Bid;
                        double stop = (dir == BiasDirection.Bullish) ? (lo - _config.StopBufferPipsOB * pip) : (hi + _config.StopBufferPipsOB * pip);
                        if (dir == BiasDirection.Bullish && stop >= entry) stop = entry - 10 * pip;
                        if (dir == BiasDirection.Bearish && stop <= entry) stop = entry + 10 * pip;
                        double raw = Math.Abs(entry - stop) / pip;
                        if (raw < _config.MinStopPipsClamp)
                            stop = (entry > stop) ? entry - _config.MinStopPipsClamp * pip : entry + _config.MinStopPipsClamp * pip;
                        if (_config.RequireMicroBreak && !ConfirmBreak(dir)) { if (_config.EnableDebugLogging) _journal.Debug("OB: micro-break gate blocked"); continue; }

                        // OCT 28 EMERGENCY FIX: DISABLED - This gate was causing 40pp WR drop (47% → 7.5%)
                        // GATE: Require MSS opposite liquidity to be set (prevents low-RR random liquidity targets)
                        // if (_state.OppositeLiquidityLevel <= 0)
                        // {
                        //     if (_config.EnableDebugLogging)
                        //         _journal.Debug($"OB: No MSS opposite liquidity set (OppLiq={_state.OppositeLiquidityLevel:F5}) → Skipping to avoid low-RR targets");
                        //     continue;
                        // }

                        double? tpPriceOB = null;
                        if (_config.UseOppositeLiquidityTP)
                        {
                            double rawStopPips = Math.Abs(entry - stop) / pip;
                            var opp = FindOppositeLiquidityTargetWithMinRR(dir == BiasDirection.Bullish, entry, rawStopPips, _config.MinRiskReward);
                            if (opp.HasValue)
                            {
                                double spreadPipsNow = Symbol.Spread / pip;
                                if (_config.SpreadCushionUseAvg && _state.SpreadPips.Count > 0)
                                {
                                    double sum = 0; foreach (var v in _state.SpreadPips) sum += v; spreadPipsNow = sum / _state.SpreadPips.Count;
                                }
                                double cushion = _config.EnableTpSpreadCushion ? Math.Max(spreadPipsNow, _config.SpreadCushionExtraPips) : _config.SpreadCushionExtraPips;
                                tpPriceOB = (dir == BiasDirection.Bullish) ? (opp.Value - (_config.TpOffsetPips + cushion) * pip)
                                                                           : (opp.Value + (_config.TpOffsetPips + cushion) * pip);
                            }
                        }
                        var tsOB = new TradeSignal { Direction = dir, EntryPrice = entry, StopLoss = stop, TakeProfit = tpPriceOB ?? 0, Timestamp = Server.Time, OrderBlock = activeOb };
                        // Min RR filter - REMOVED: Let TradeManager's ChooseTakeProfit calculate fallback TP
                        if (_config.EnableDebugLogging)
                        {
                            double rrOB = 0; if (tpPriceOB.HasValue) rrOB = Math.Abs(tpPriceOB.Value - entry) / Math.Max(1e-6, Math.Abs(entry - stop));
                            _journal.Debug($"OB Signal: entry={entry:F5} stop={stop:F5} tp={tpPriceOB?.ToString("F5") ?? "fallback"} | RR={rrOB:F2}");
                        }
                        if (_config.EnableDebugLogging) _journal.Debug($"ENTRY OB: dir={dir} entry={entry:F5} stop={stop:F5}");

                        // Apply phase-based logic (Phase 1 for OB entries)
                        return ApplyPhaseLogic(tsOB, "OB");
                    }
                }
                else if (t == "BREAKER")
                {
                    if (_config.RequireOteIfAvailable && anyOtePresent && !oteTapped) continue;
                    int swIdx, msIdx;
                    if (_config.EnableSequenceGate && !ValidateSequenceGate(entryDir, sweeps, mssSignals, out swIdx, out msIdx)) { if (_config.EnableDebugLogging) _journal.Debug("Breaker: sequence gate failed"); continue; }
                    // REMOVED: OTE-only restriction when sequence fallback is used - Breaker can produce quality 1:3 RR signals even with 200-400 bar lookback
                    var activeBrk = breakerBlocks?
                        .Where(b => b.Direction == entryDir)
                        .OrderBy(b => Math.Abs(mid - ((Math.Min(b.LowPrice, b.HighPrice) + Math.Max(b.LowPrice, b.HighPrice)) * 0.5)))
                        .FirstOrDefault(b =>
                        {
                            double blo = Math.Min(b.LowPrice, b.HighPrice);
                            double bhi = Math.Max(b.LowPrice, b.HighPrice);
                            if (_config.BreakerEntryAtMid)
                            {
                                double midB = (blo + bhi) * 0.5;
                                return PriceTouchesZone(midB, midB, tol);
                            }
                            return PriceTouchesZone(blo, bhi, tol);
                        });
                    if (activeBrk != null)
                    {
                        if (_config.RequireDualTap && _config.DualTapPair == DualTapPairEnum.OTE_Breaker)
                        {
                            bool oteExist = (oteZones ?? new List<OTEZone>()).Any(z => z.Direction == entryDir);
                            bool overlapTapped = false;
                            if (oteExist)
                            {
                                foreach (var z in (oteZones ?? new List<OTEZone>()).Where(z => z.Direction == entryDir))
                                {
                                    if (TryOverlap(z.Low, z.High, Math.Min(activeBrk.LowPrice, activeBrk.HighPrice), Math.Max(activeBrk.LowPrice, activeBrk.HighPrice), tolOverlap, out var oLo, out var oHi))
                                    {
                                        if (PriceTouchesZone(oLo, oHi, tol)) { overlapTapped = true; break; }
                                    }
                                }
                                if (!overlapTapped) return null; // require overlap tap when both exist
                            }
                        }
                        var dir = activeBrk.Direction;
                        double lo = Math.Min(activeBrk.LowPrice, activeBrk.HighPrice);
                        double hi = Math.Max(activeBrk.LowPrice, activeBrk.HighPrice);
                        if (!IsPullbackTap(dir, lo, hi)) { if (_config.EnableDebugLogging) _journal.Debug("Breaker: pullback gate blocked"); continue; }
                        double entry = (dir == BiasDirection.Bullish) ? Symbol.Ask : Symbol.Bid;
                        double stop;
                        DateTime tFa; double faLow, faHigh;
                        if (TryGetFractalSwingAnchor(dir == BiasDirection.Bullish, out tFa, out faLow, out faHigh))
                        {
                            double baseSwing = (dir == BiasDirection.Bullish) ? faLow : faHigh;
                            stop = (dir == BiasDirection.Bullish) ? baseSwing - _config.StopExtraPipsSeq * pip : baseSwing + _config.StopExtraPipsSeq * pip;
                        }
                        else
                        {
                            stop = (dir == BiasDirection.Bullish) ? (lo - _config.StopBufferPipsOB * pip) : (hi + _config.StopBufferPipsOB * pip);
                        }
                        if (dir == BiasDirection.Bullish && stop >= entry) stop = entry - 10 * pip;
                        if (dir == BiasDirection.Bearish && stop <= entry) stop = entry + 10 * pip;
                        double raw = Math.Abs(entry - stop) / pip;
                        if (raw < _config.MinStopPipsClamp)
                            stop = (entry > stop) ? entry - _config.MinStopPipsClamp * pip : entry + _config.MinStopPipsClamp * pip;
                        if (_config.RequireMicroBreak && !ConfirmBreak(dir)) { if (_config.EnableDebugLogging) _journal.Debug("Breaker: micro-break gate blocked"); continue; }
                        double? tpPrice = null;
                        if (_config.UseOppositeLiquidityTP)
                        {
                            var opp = FindOppositeLiquidityTarget(dir == BiasDirection.Bullish, entry);
                            if (opp.HasValue)
                            {
                                double spreadPips = Symbol.Spread / pip;
                                if (_config.SpreadCushionUseAvg && _state.SpreadPips.Count > 0)
                                {
                                    double sum = 0; foreach (var v in _state.SpreadPips) sum += v; spreadPips = sum / _state.SpreadPips.Count;
                                }
                                double cushion = _config.EnableTpSpreadCushion ? Math.Max(spreadPips, _config.SpreadCushionExtraPips) : _config.SpreadCushionExtraPips;
                                tpPrice = (dir == BiasDirection.Bullish) ? (opp.Value - (_config.TpOffsetPips + cushion) * pip)
                                                                         : (opp.Value + (_config.TpOffsetPips + cushion) * pip);
                            }
                        }
                        var tsBR = new TradeSignal { Direction = dir, EntryPrice = entry, StopLoss = stop, TakeProfit = tpPrice ?? 0, Timestamp = Server.Time };
                        if (_config.EnableDebugLogging) _journal.Debug($"ENTRY Breaker: dir={dir} entry={entry:F5} stop={stop:F5} tp={(tpPrice?.ToString("F5") ?? "-")}");

                        // Apply phase-based logic (Phase 1 for Breaker entries)
                        return ApplyPhaseLogic(tsBR, "BREAKER");
                    }
                }
            }

            // No tap at any POI ? no trade
            return null;
        }

        // ═══════════════════════════════════════════════════════════════════
        // HUMAN-LIKE UNIFIED CONFIDENCE SCORE (OCT 30)
        // Synthesizes all "senses" into conviction level (0.0-1.0)
        // ═══════════════════════════════════════════════════════════════════
        private double CalculateUnifiedConfidenceScore(BiasDirection entryDirection)
        {
            double finalScore = 0.0;

            // COMPONENT 1: BIAS CONTEXT (30%) - HTF bias alignment and strength
            double biasScore = 0.0;

            // Sub-component 1a: BiasStateMachine state (10%)
            if (_biasStateMachine != null)
            {
                var biasState = _biasStateMachine.GetState();
                if (biasState == BiasState.READY_FOR_ENTRY)
                    biasScore += 0.10;
                else if (biasState == BiasState.AWAITING_SWEEP)
                    biasScore += 0.05;
                // IDLE = 0.0
            }

            // Sub-component 1b: IntelligentBiasAnalyzer strength (20%)
            if (_intelligentAnalyzer != null)
            {
                var biasAnalysis = _intelligentAnalyzer.GetIntelligentBias(Bars.TimeFrame);
                double biasStrength = biasAnalysis.Strength; // Returns 0-100
                double normalizedStrength = biasStrength / 100.0; // Normalize to 0-1

                // Check if HTF bias aligns with entry direction
                BiasDirection htfBias = BiasDirection.Neutral;
                if (_mtfBias != null)
                {
                    var dailyContext = _mtfBias.GetDailyContext();
                    if (dailyContext != null)
                        htfBias = dailyContext.DailyBias;
                }
                bool aligned = (htfBias == entryDirection);

                if (aligned)
                    biasScore += normalizedStrength * 0.20; // Full 20% weight if aligned
                else
                    biasScore += normalizedStrength * 0.05; // Penalize misalignment
            }

            finalScore += biasScore; // Max 0.30

            // COMPONENT 2: PRICE ACTION QUALITY (40%) - MSS + Pullback analysis
            double priceActionScore = 0.0;

            if (_currentMSSQuality != null)
            {
                // MSS strength score (0.0-1.0 from PriceActionAnalyzer)
                double mssContribution = _currentMSSQuality.StrengthScore * 0.25; // 25% from MSS

                // Bonus for quality assessment
                if (_currentMSSQuality.Quality == PriceActionAnalyzer.MoveQuality.StrongImpulsive)
                    mssContribution += 0.05;
                else if (_currentMSSQuality.Quality == PriceActionAnalyzer.MoveQuality.Impulsive)
                    mssContribution += 0.03;
                // Neutral/Corrective gets no bonus

                priceActionScore += mssContribution;
            }

            if (_currentPullbackQuality != null)
            {
                // Pullback strength score
                double pullbackContribution = _currentPullbackQuality.StrengthScore * 0.15; // 15% from pullback

                // Bonus for clean corrective pullback (ideal for OTE)
                if (_currentPullbackQuality.Quality == PriceActionAnalyzer.MoveQuality.Corrective)
                    pullbackContribution += 0.03;

                priceActionScore += pullbackContribution;
            }

            finalScore += priceActionScore; // Max 0.40

            // COMPONENT 3: NEWS CONTEXT (15%) - Smart news analysis
            double newsScore = 0.0;

            if (_smartNews != null)
            {
                BiasDirection currentBias = BiasDirection.Neutral;
                if (_mtfBias != null)
                {
                    var dailyContext = _mtfBias.GetDailyContext();
                    if (dailyContext != null)
                        currentBias = dailyContext.DailyBias;
                }

                var newsAnalysis = _smartNews.AnalyzeNewsContext(currentBias, Server.TimeInUtc);

                if (newsAnalysis.Context == NewsContext.Normal)
                    newsScore = 0.15; // Full 15% for normal conditions
                else if (newsAnalysis.Context == NewsContext.PreHighImpact)
                    newsScore = 0.05; // Reduced confidence before news
                else if (newsAnalysis.Context == NewsContext.PostConfirmation)
                    newsScore = 0.12; // Good for continuation
                else if (newsAnalysis.Context == NewsContext.PostChoppy)
                    newsScore = 0.0; // No confidence during choppy news
            }
            else
            {
                // Fallback: assume normal conditions
                newsScore = 0.10;
            }

            finalScore += newsScore; // Max 0.15

            // COMPONENT 4: HISTORICAL CONTEXT (15%) - Adaptive learning win rates
            double historicalScore = 0.0;

            if (_learningEngine != null && _config.EnableAdaptiveLearning)
            {
                // Calculate historical win rate for this setup type
                // Use current session/killzone context
                string setupType = DetermineSetupType(); // "Bullish OTE NY Session", etc.

                double oteConfidence = _learningEngine.CalculateOteConfidence(0.618, _config.TapTolerancePips);

                // Historical win rate component (15% weight)
                historicalScore = oteConfidence * 0.15;
            }
            else
            {
                // Fallback: neutral historical score
                historicalScore = 0.075; // 50% of 15% weight
            }

            finalScore += historicalScore; // Max 0.15

            // Clamp final score to 0.0-1.0 range
            finalScore = Math.Max(0.0, Math.Min(1.0, finalScore));

            if (_config.EnableDebugLogging)
            {
                _journal.Debug($"[UNIFIED CONFIDENCE] Final={finalScore:F2} | Bias={biasScore:F2} | PriceAction={priceActionScore:F2} | News={newsScore:F2} | Historical={historicalScore:F2}");
            }

            return finalScore;
        }

        // Helper to determine setup type for historical learning
        private string DetermineSetupType()
        {
            BiasDirection dailyBias = BiasDirection.Neutral;
            if (_mtfBias != null)
            {
                var dailyContext = _mtfBias.GetDailyContext();
                if (dailyContext != null)
                    dailyBias = dailyContext.DailyBias;
            }

            string direction = (dailyBias == BiasDirection.Bullish) ? "Bullish" : "Bearish";
            string session = DetermineCurrentSession(); // "Asia", "London", "NY"
            string poiType = (_state.ActiveOTE != null) ? "OTE" : "OB";

            return $"{direction} {poiType} {session} Session";
        }

        private string DetermineCurrentSession()
        {
            var utcTime = Server.TimeInUtc;
            int hour = utcTime.Hour;

            // Asia: 00:00-09:00 UTC
            if (hour >= 0 && hour < 9)
                return "Asia";
            // London: 08:00-17:00 UTC
            else if (hour >= 8 && hour < 17)
                return "London";
            // NY: 13:00-22:00 UTC
            else if (hour >= 13 && hour < 22)
                return "NY";
            else
                return "Unknown";
        }

        // ═══════════════════════════════════════════════════════════════════
        // CHANGE #2: STRUCTURAL STOP LOSS HELPER (OCT 30, 2025)
        // ═══════════════════════════════════════════════════════════════════
        /// <summary>
        /// Calculates stop loss using either structural swing invalidation or fixed pips.
        /// Integrates SweepBufferCalculator for adaptive ATR-based buffer.
        /// </summary>
        private double CalculateStopLoss(double entryPrice, BiasDirection direction, string poiType)
        {
            TradeType tradeType = (direction == BiasDirection.Bullish) ? TradeType.Buy : TradeType.Sell;

            // Determine buffer pips based on POI type (adaptive ATR-based buffer from config)
            double bufferPips = poiType == "OTE" ? _config.StopBufferPipsOTE :
                                poiType == "FVG" ? _config.StopBufferPipsFVG :
                                _config.StopBufferPipsOB;

            if (_config.UseStructuralStopLoss && _structuralSL != null)
            {
                // Use swing-based structural invalidation
                var slResult = _structuralSL.CalculateStructuralSL(
                    Bars,
                    entryPrice,
                    tradeType,
                    bufferPips: bufferPips,
                    minSLPips: _config.MinStopPipsClamp,
                    maxSLPips: 50.0,
                    swingPivot: 2
                );

                if (_config.EnableDebugLogging)
                    _journal.Debug($"[STRUCTURAL SL] {direction} {poiType} | Swing: {slResult.InvalidationLevel:F5} | SL: {slResult.StopLossPrice:F5} ({slResult.StopLossPips:F1} pips) | Buffer: {bufferPips:F1} pips | Clamped: {slResult.WasClamped}");

                return slResult.StopLossPrice;
            }
            else
            {
                // Use fixed-pip stop loss (original logic)
                double pipDistance = bufferPips * Symbol.PipSize;
                double stopLoss = (direction == BiasDirection.Bullish) ? entryPrice - pipDistance : entryPrice + pipDistance;

                if (_config.EnableDebugLogging)
                    _journal.Debug($"[FIXED SL] {direction} {poiType} | Entry: {entryPrice:F5} | SL: {stopLoss:F5} ({bufferPips:F1} pips)");

                return stopLoss;
            }
        }

        // ═══════════════════════════════════════════════════════════════════
        // UNIFIED CONFIDENCE SCORING - Combines all enhancement phases (LEGACY)
        // ═══════════════════════════════════════════════════════════════════
        private double CalculateFinalConfidence(
            TradeSignal signal,
            List<MSSSignal> mssSignals,
            List<LiquiditySweep> sweeps,
            bool? smtDirection,
            MarketRegime regime)
        {
            double finalScore = 0.5; // Start neutral
            int componentCount = 0;
            double totalWeight = 0;

            // Component 1: MSS Quality (30% weight)
            if (_learningEngine != null && _config.EnableAdaptiveLearning && mssSignals != null && mssSignals.Count > 0)
            {
                var lastMss = mssSignals.LastOrDefault();
                if (lastMss != null)
                {
                    double displacementPips = Math.Abs(lastMss.ImpulseEnd - lastMss.ImpulseStart) / Symbol.PipSize;
                    double displacementATR = displacementPips / 10.0;
                    double mssQuality = _learningEngine.CalculateMssQuality(displacementATR, true);
                    finalScore += mssQuality * 0.3;
                    totalWeight += 0.3;
                    componentCount++;
                }
            }

            // Component 2: OTE Confidence (30% weight)
            if (_learningEngine != null && _config.EnableAdaptiveLearning && signal.OTEZone != null)
            {
                double fibLevel = 0.618;
                double bufferPips = _config.TapTolerancePips;
                double oteConfidence = _learningEngine.CalculateOteConfidence(fibLevel, bufferPips);
                finalScore += oteConfidence * 0.3;
                totalWeight += 0.3;
                componentCount++;
            }

            // Component 3: Sweep Reliability (20% weight)
            if (_learningEngine != null && _config.EnableAdaptiveLearning && sweeps != null && sweeps.Count > 0)
            {
                var lastSweep = sweeps.LastOrDefault();
                if (lastSweep != null)
                {
                    double sweepReliability = _learningEngine.CalculateSweepReliability(lastSweep.Label ?? "Unknown", 0);
                    finalScore += sweepReliability * 0.2;
                    totalWeight += 0.2;
                    componentCount++;
                }
            }

            // Component 4: SMT Confirmation (10% weight)
            if (smtDirection.HasValue)
            {
                bool signalIsBullish = signal.Direction == BiasDirection.Bullish;
                bool smtConfirms = signalIsBullish == smtDirection.Value;
                double smtFactor = smtConfirms ? 0.7 : 0.3; // Confirm = 0.7, Conflict = 0.3
                finalScore += smtFactor * 0.1;
                totalWeight += 0.1;
                componentCount++;
            }

            // Component 5: Regime Factor (10% weight)
            double regimeFactor = 0.5; // Neutral default
            if (regime == MarketRegime.Trending && signal.EntryPrice != signal.StopLoss)
            {
                // Trending market - favor trend-following (OTE) setups
                regimeFactor = signal.OTEZone != null ? 0.7 : 0.4;
            }
            else if (regime == MarketRegime.Ranging)
            {
                // Ranging market - favor mean reversion (OB/FVG) setups
                regimeFactor = signal.OrderBlock != null ? 0.7 : 0.4;
            }
            else if (regime == MarketRegime.Volatile)
            {
                regimeFactor = 0.4; // Reduce confidence in volatile conditions
            }
            finalScore += regimeFactor * 0.1;
            totalWeight += 0.1;
            componentCount++;

            // Component 6: ADVANCED FEATURE - Pattern Recognition (5% weight)
            if (_patternRecognizer != null && Bars != null && Bars.Count > 3)
            {
                int lastBarIndex = Bars.Count - 1;
                CandlePattern pattern = _patternRecognizer.DetectPattern(Bars, lastBarIndex);

                if (pattern != CandlePattern.None)
                {
                    double patternStrength = _patternRecognizer.GetPatternStrength(pattern, Bars, lastBarIndex);
                    bool patternConfirms = _patternRecognizer.PatternConfirmsDirection(pattern, signal.Direction);

                    // If pattern confirms direction, add bonus; if conflicts, apply penalty
                    double patternFactor = patternConfirms ? patternStrength : (1.0 - patternStrength) * 0.5;

                    finalScore += patternFactor * 0.05;
                    totalWeight += 0.05;
                    componentCount++;

                    if (_config.EnableDebugLogging)
                        _journal.Debug($"[CONFIDENCE] Pattern {pattern} detected | Strength={patternStrength:F2} | Confirms={patternConfirms} → Factor={patternFactor:F2}");
                }
            }

            // Component 7: ADVANCED FEATURE - Intermarket Analysis (5% weight)
            if (_intermarketAnalysis != null)
            {
                double intermarketFactor = _intermarketAnalysis.GetIntermarketConfidenceFactor(signal.Direction);
                MarketSentiment sentiment = _intermarketAnalysis.GetMarketSentiment();

                // Convert multiplier (0.9-1.1) to additive score
                // 1.1 → +0.05, 1.0 → 0, 0.9 → -0.05
                double intermarketScore = (intermarketFactor - 1.0) * 0.5;  // Maps to [-0.05, +0.05]

                finalScore += intermarketScore;
                totalWeight += 0.05;
                componentCount++;

                if (_config.EnableDebugLogging)
                    _journal.Debug($"[CONFIDENCE] Intermarket sentiment={sentiment} | Factor={intermarketFactor:F2} | Score={intermarketScore:F3}");
            }

            // Component 8: ADVANCED FEATURE - Smart News Context Analysis (5% weight)
            if (_currentNewsContext != null)
            {
                // Smart news adjustment ranges from -0.5 to +0.3
                // Map to component score: -0.025 to +0.015 (5% weight)
                double newsScore = _currentNewsContext.ConfidenceAdjustment * 0.05;

                finalScore += newsScore;
                totalWeight += 0.05;
                componentCount++;

                if (_config.EnableDebugLogging)
                    _journal.Debug($"[CONFIDENCE] Smart News | Context={_currentNewsContext.Context} | Reaction={_currentNewsContext.Reaction} | Adjustment={_currentNewsContext.ConfidenceAdjustment:F2} | Score={newsScore:F3}");
            }
            else if (_newsAwareness != null)
            {
                // Fallback to legacy news awareness if smart news not available
                NewsEnvironment newsEnv = _newsAwareness.GetNewsEnvironment();
                double newsFactor = _newsAwareness.GetNewsConfidenceFactor();
                bool postNewsContinuation = _newsAwareness.IsPostNewsContinuation();

                double newsScore = (newsFactor - 1.0) * 0.25;

                finalScore += newsScore;
                totalWeight += 0.05;
                componentCount++;

                if (_config.EnableDebugLogging)
                    _journal.Debug($"[CONFIDENCE] Legacy News env={newsEnv} | Factor={newsFactor:F2} | PostNewsContinuation={postNewsContinuation} | Score={newsScore:F3}");
            }

            // Component 9: ADVANCED FEATURE - Multi-Timeframe Bias Confluence (10% weight)
            if (_currentBiasConfluence != null)
            {
                // MTF Bias Confluence Score ranges from -5 to +10
                // Map to 0.0-1.0 range for additive scoring
                // Score 0 → 0.05, Score 6 (high prob) → 0.10, Score 10 → 0.13, Score -5 → 0.0
                double normalizedScore = Math.Max(0.0, (_currentBiasConfluence.Score + 5) / 15.0); // Maps [-5,10] → [0.0, 1.0]
                double mtfScore = normalizedScore * 0.10; // Apply 10% weight

                // Alignment bonus: if MTF direction matches signal direction, add extra weight
                bool directionAligned = (_currentBiasConfluence.Direction == signal.Direction);
                if (directionAligned && _currentBiasConfluence.HighProbabilitySetup)
                {
                    mtfScore += 0.02; // +2% bonus for high-prob aligned setup
                }

                finalScore += mtfScore;
                totalWeight += 0.10;
                componentCount++;

                if (_config.EnableDebugLogging)
                    _journal.Debug($"[CONFIDENCE] MTF Bias | Score={_currentBiasConfluence.Score} | Strength={_currentBiasConfluence.Strength} | Aligned={directionAligned} | Contribution={mtfScore:F3}");
            }

            // Component 10: ADVANCED FEATURE - Price Action Dynamics (8% weight)
            if (_currentMSSQuality != null && _currentPullbackQuality != null)
            {
                // Combine MSS break quality and pullback quality
                // MSS: Impulsive = good (0.7-1.0), Pullback: Corrective = good (0.6-0.8)
                double mssContribution = _currentMSSQuality.StrengthScore * 0.5; // 50% from MSS quality
                double pullbackContribution = _currentPullbackQuality.StrengthScore * 0.5; // 50% from pullback quality

                double paScore = (mssContribution + pullbackContribution) * 0.08; // 8% weight

                // Bonus for ideal combination: Strong impulsive MSS + clean corrective pullback
                if (_currentMSSQuality.Quality == PriceActionAnalyzer.MoveQuality.StrongImpulsive &&
                    _currentMSSQuality.Momentum == PriceActionAnalyzer.MomentumState.Accelerating &&
                    _currentPullbackQuality.Quality == PriceActionAnalyzer.MoveQuality.Corrective)
                {
                    paScore += 0.02; // +2% bonus for textbook setup
                }

                finalScore += paScore;
                totalWeight += 0.08;
                componentCount++;

                if (_config.EnableDebugLogging)
                    _journal.Debug($"[CONFIDENCE] Price Action | MSS={_currentMSSQuality.Quality}/{_currentMSSQuality.Momentum} ({_currentMSSQuality.StrengthScore:F2}) | Pullback={_currentPullbackQuality.Quality} ({_currentPullbackQuality.StrengthScore:F2}) | Score={paScore:F3}");
            }
            else if (_currentMSSQuality != null)
            {
                // MSS quality only (no pullback analysis yet)
                double paScore = _currentMSSQuality.StrengthScore * 0.08;
                finalScore += paScore;
                totalWeight += 0.08;
                componentCount++;

                if (_config.EnableDebugLogging)
                    _journal.Debug($"[CONFIDENCE] Price Action | MSS Only: {_currentMSSQuality.Quality}/{_currentMSSQuality.Momentum} | Score={paScore:F3}");
            }

            // Normalize if not all components present
            if (totalWeight > 0 && totalWeight < 1.0)
            {
                finalScore = finalScore / totalWeight; // Scale up to 0-1 range
            }

            // Clamp to 0-1 range
            finalScore = Math.Max(0.0, Math.Min(1.0, finalScore));

            if (_config.EnableDebugLogging)
            {
                _journal.Debug($"[CONFIDENCE] Final={finalScore:F2} | Components={componentCount} | Regime={regime}");
            }

            return finalScore;
        }

        // ═══════════════════════════════════════════════════════════════════
        // ENRICH SIGNAL WITH UNIFIED CONFIDENCE + EXPLAINABLE AI
        // ═══════════════════════════════════════════════════════════════════
        private void EnrichSignalWithConfidence(TradeSignal signal)
        {
            if (signal == null)
                return;

            // Calculate unified confidence using stored context
            double confidence = CalculateFinalConfidence(
                signal,
                _currentMssSignals,
                _currentSweeps,
                _currentSmtDirection,
                _currentRegime
            );

            // Assign to signal
            signal.ConfidenceScore = confidence;

            if (_config.EnableDebugLogging)
            {
                // ADVANCED FEATURE: EXPLAINABLE AI LOGGING
                // Generate human-readable explanation of why this signal was scored this way
                string signalType = signal.OTEZone != null ? "OTE" :
                                   signal.OrderBlock != null ? "OB" : "Other";

                string explanation = GenerateSignalExplanation(signal, confidence);

                _journal.Debug($"[UNIFIED CONFIDENCE] Signal enriched | Type: {signalType} | Confidence: {confidence:F2}");
                _journal.Debug($"[EXPLAINABLE AI] {explanation}");
            }
        }

        // ═══════════════════════════════════════════════════════════════════
        // ADVANCED FEATURE: EXPLAINABLE AI - HUMAN-READABLE DECISION LOGS
        // ═══════════════════════════════════════════════════════════════════
        private string GenerateSignalExplanation(TradeSignal signal, double finalConfidence)
        {
            var reasons = new List<string>();

            // 1. MSS Quality Explanation
            if (_learningEngine != null && _config.EnableAdaptiveLearning && _currentMssSignals != null && _currentMssSignals.Count > 0)
            {
                var lastMss = _currentMssSignals.LastOrDefault();
                if (lastMss != null)
                {
                    double displacementPips = Math.Abs(lastMss.ImpulseEnd - lastMss.ImpulseStart) / Symbol.PipSize;
                    double mssQuality = _learningEngine.CalculateMssQuality(displacementPips / 10.0, true);

                    if (mssQuality >= 0.7)
                        reasons.Add($"✅ STRONG MSS ({mssQuality:F2}): {displacementPips:F1} pip displacement shows conviction");
                    else if (mssQuality >= 0.5)
                        reasons.Add($"⚠️ MODERATE MSS ({mssQuality:F2}): {displacementPips:F1} pip displacement is average");
                    else
                        reasons.Add($"❌ WEAK MSS ({mssQuality:F2}): {displacementPips:F1} pip displacement lacks strength");
                }
            }

            // 2. OTE Confidence Explanation
            if (_learningEngine != null && _config.EnableAdaptiveLearning && signal.OTEZone != null)
            {
                double oteConfidence = _learningEngine.CalculateOteConfidence(0.618, _config.TapTolerancePips);

                if (oteConfidence >= 0.7)
                    reasons.Add($"✅ OPTIMAL OTE ({oteConfidence:F2}): Historical sweet spot confirmed");
                else if (oteConfidence >= 0.5)
                    reasons.Add($"⚠️ STANDARD OTE ({oteConfidence:F2}): Typical retracement level");
                else
                    reasons.Add($"❌ POOR OTE ({oteConfidence:F2}): Level historically underperforms");
            }

            // 3. Sweep Reliability Explanation
            if (_learningEngine != null && _config.EnableAdaptiveLearning && _currentSweeps != null && _currentSweeps.Count > 0)
            {
                var lastSweep = _currentSweeps.LastOrDefault();
                if (lastSweep != null)
                {
                    // Calculate excess pips from sweep candle range
                    double excessPips = (lastSweep.SweepCandleHigh - lastSweep.SweepCandleLow) / Symbol.PipSize;
                    double sweepReliability = _learningEngine.CalculateSweepReliability(lastSweep.Label, excessPips);

                    if (sweepReliability >= 0.65)
                        reasons.Add($"✅ QUALITY SWEEP ({sweepReliability:F2}): {lastSweep.Label} with {excessPips:F1}p range typically works");
                    else if (sweepReliability >= 0.45)
                        reasons.Add($"⚠️ AVERAGE SWEEP ({sweepReliability:F2}): {lastSweep.Label} has mixed results");
                    else
                        reasons.Add($"❌ UNRELIABLE SWEEP ({sweepReliability:F2}): {lastSweep.Label} historically fails");
                }
            }

            // 4. SMT Alignment Explanation
            if (_config.EnableSMT && _currentSmtDirection.HasValue)
            {
                bool smtAligned = (signal.Direction == BiasDirection.Bullish && _currentSmtDirection.Value) ||
                                 (signal.Direction == BiasDirection.Bearish && !_currentSmtDirection.Value);

                if (smtAligned)
                    reasons.Add($"✅ SMT ALIGNED: DXY confirms {signal.Direction} direction");
                else
                    reasons.Add($"❌ SMT DIVERGENCE: DXY conflicts with {signal.Direction} signal");
            }

            // 5. Market Regime Explanation
            string regimeText = _currentRegime.ToString();
            if (_currentRegime == MarketRegime.Trending && signal.OTEZone != null)
                reasons.Add($"✅ REGIME BOOST: {regimeText} market favors OTE entries (+0.3 bonus)");
            else if (_currentRegime == MarketRegime.Ranging && signal.OrderBlock != null)
                reasons.Add($"✅ REGIME BOOST: {regimeText} market favors structure-based entries (+0.2 bonus)");
            else if (_currentRegime == MarketRegime.Volatile)
                reasons.Add($"❌ REGIME PENALTY: {regimeText} market reduces confidence (-0.2)");
            else
                reasons.Add($"⚠️ NEUTRAL REGIME: {regimeText} market (no adjustment)");

            // 6. ADVANCED FEATURE - Pattern Recognition Explanation
            if (_patternRecognizer != null && Bars != null && Bars.Count > 3)
            {
                int lastBarIndex = Bars.Count - 1;
                CandlePattern pattern = _patternRecognizer.DetectPattern(Bars, lastBarIndex);

                if (pattern != CandlePattern.None)
                {
                    double patternStrength = _patternRecognizer.GetPatternStrength(pattern, Bars, lastBarIndex);
                    bool patternConfirms = _patternRecognizer.PatternConfirmsDirection(pattern, signal.Direction);

                    if (patternConfirms && patternStrength >= 0.7)
                        reasons.Add($"✅ PATTERN BOOST: {pattern} confirms {signal.Direction} (strength={patternStrength:F2})");
                    else if (patternConfirms)
                        reasons.Add($"⚠️ PATTERN NEUTRAL: {pattern} weakly confirms {signal.Direction} (strength={patternStrength:F2})");
                    else
                        reasons.Add($"❌ PATTERN CONFLICT: {pattern} conflicts with {signal.Direction} (strength={patternStrength:F2})");
                }
            }

            // 7. ADVANCED FEATURE - Intermarket Analysis Explanation
            if (_intermarketAnalysis != null)
            {
                MarketSentiment sentiment = _intermarketAnalysis.GetMarketSentiment();
                double factor = _intermarketAnalysis.GetIntermarketConfidenceFactor(signal.Direction);

                string sentimentText = sentiment == MarketSentiment.RiskOn ? "RISK-ON (stocks up, yields rising)" :
                                      sentiment == MarketSentiment.RiskOff ? "RISK-OFF (safe havens up)" :
                                      "NEUTRAL (mixed signals)";

                if (signal.Direction == BiasDirection.Bullish)
                {
                    if (sentiment == MarketSentiment.RiskOn)
                        reasons.Add($"✅ INTERMARKET BOOST: {sentimentText} → EUR strength expected");
                    else if (sentiment == MarketSentiment.RiskOff)
                        reasons.Add($"❌ INTERMARKET CONFLICT: {sentimentText} → USD strength expected (opposing EUR longs)");
                    else
                        reasons.Add($"⚠️ INTERMARKET NEUTRAL: {sentimentText}");
                }
                else if (signal.Direction == BiasDirection.Bearish)
                {
                    if (sentiment == MarketSentiment.RiskOff)
                        reasons.Add($"✅ INTERMARKET BOOST: {sentimentText} → USD strength expected");
                    else if (sentiment == MarketSentiment.RiskOn)
                        reasons.Add($"❌ INTERMARKET CONFLICT: {sentimentText} → EUR strength expected (opposing EUR shorts)");
                    else
                        reasons.Add($"⚠️ INTERMARKET NEUTRAL: {sentimentText}");
                }
            }

            // 8. ADVANCED FEATURE - Smart News Context Analysis Explanation
            if (_currentNewsContext != null)
            {
                // Use smart news context reasoning (context-aware analysis)
                string contextIcon = _currentNewsContext.Context == NewsContext.PreHighImpact ? "🚫" :
                                    _currentNewsContext.Context == NewsContext.PostConfirmation ? "✅" :
                                    _currentNewsContext.Context == NewsContext.PostContradiction ? "❌" :
                                    _currentNewsContext.Context == NewsContext.PostChoppy ? "⚠️" : "🔵";

                string confidenceText = _currentNewsContext.ConfidenceAdjustment >= 0.2 ? "MAJOR BOOST" :
                                       _currentNewsContext.ConfidenceAdjustment >= 0.1 ? "MODERATE BOOST" :
                                       _currentNewsContext.ConfidenceAdjustment >= 0 ? "SLIGHT BOOST" :
                                       _currentNewsContext.ConfidenceAdjustment >= -0.2 ? "SLIGHT REDUCTION" :
                                       _currentNewsContext.ConfidenceAdjustment >= -0.4 ? "MODERATE REDUCTION" : "MAJOR PENALTY";

                reasons.Add($"{contextIcon} SMART NEWS: {_currentNewsContext.Context} → {confidenceText} (adj={_currentNewsContext.ConfidenceAdjustment:+0.0;-0.0})");
                reasons.Add($"   {_currentNewsContext.Reasoning}");
            }
            else if (_newsAwareness != null)
            {
                // Fallback to legacy news awareness
                NewsEnvironment newsEnv = _newsAwareness.GetNewsEnvironment();
                bool postNewsContinuation = _newsAwareness.IsPostNewsContinuation();

                if (newsEnv == NewsEnvironment.PreNews)
                    reasons.Add($"❌ LEGACY NEWS: Pre-news blackout window → Reduced confidence");
                else if (newsEnv == NewsEnvironment.PostNews && postNewsContinuation)
                    reasons.Add($"✅ LEGACY NEWS: Post-news continuation → Enhanced confidence");
                else if (newsEnv == NewsEnvironment.PostNews)
                    reasons.Add($"⚠️ LEGACY NEWS: Post-news environment → Slight reduction");
                else if (newsEnv == NewsEnvironment.HighVolatility)
                    reasons.Add($"❌ LEGACY NEWS: High volatility → Reduced confidence");
                else
                    reasons.Add($"✅ NEWS CLEAR: Normal market conditions");
            }

            // 9. ADVANCED FEATURE - Multi-Timeframe Bias Confluence Explanation
            if (_currentBiasConfluence != null)
            {
                var dailyCtx = _mtfBias?.GetDailyContext();
                var intradayCtx = _mtfBias?.GetIntradayContext();

                string biasIcon = _currentBiasConfluence.Score >= 6 ? "🚀" :
                                 _currentBiasConfluence.Score >= 3 ? "✅" :
                                 _currentBiasConfluence.Score >= 0 ? "⚠️" : "❌";

                string strengthText = _currentBiasConfluence.Strength == BiasStrength.VeryStrong ? "VERY STRONG" :
                                     _currentBiasConfluence.Strength == BiasStrength.Strong ? "STRONG" :
                                     _currentBiasConfluence.Strength == BiasStrength.Moderate ? "MODERATE" :
                                     _currentBiasConfluence.Strength == BiasStrength.Weak ? "WEAK" : "VERY WEAK";

                // Add main MTF assessment
                if (_currentBiasConfluence.HighProbabilitySetup)
                    reasons.Add($"{biasIcon} MTF BIAS: {strengthText} {_currentBiasConfluence.Direction} confluence (Score: {_currentBiasConfluence.Score}/10)");
                else if (_currentBiasConfluence.Score >= 3)
                    reasons.Add($"{biasIcon} MTF BIAS: {strengthText} {_currentBiasConfluence.Direction} setup (Score: {_currentBiasConfluence.Score}/10)");
                else if (_currentBiasConfluence.Score >= 0)
                    reasons.Add($"{biasIcon} MTF BIAS: {strengthText} confluence - Consider waiting (Score: {_currentBiasConfluence.Score}/10)");
                else
                    reasons.Add($"{biasIcon} MTF BIAS: CONFLICTING signals - Avoid trading (Score: {_currentBiasConfluence.Score}/10)");

                // Add context if available
                if (dailyCtx != null && intradayCtx != null)
                {
                    reasons.Add($"   Daily: {dailyCtx.DailyBias} | M15: {intradayCtx.M15Bias} | Phase: {intradayCtx.CurrentPO3Phase}");
                }

                // Add detailed reasons (first 3 for brevity)
                for (int i = 0; i < Math.Min(3, _currentBiasConfluence.Reasons.Count); i++)
                {
                    reasons.Add($"   {_currentBiasConfluence.Reasons[i]}");
                }
            }

            // 10. ADVANCED FEATURE - Price Action Dynamics Explanation
            if (_currentMSSQuality != null || _currentPullbackQuality != null)
            {
                // MSS Break Quality
                if (_currentMSSQuality != null)
                {
                    string mssIcon = _currentMSSQuality.Quality == PriceActionAnalyzer.MoveQuality.StrongImpulsive ? "🚀" :
                                    _currentMSSQuality.Quality == PriceActionAnalyzer.MoveQuality.Impulsive ? "✅" :
                                    _currentMSSQuality.Quality == PriceActionAnalyzer.MoveQuality.Neutral ? "⚠️" :
                                    _currentMSSQuality.Quality == PriceActionAnalyzer.MoveQuality.Corrective ? "❌" : "❌";

                    string momentumText = _currentMSSQuality.Momentum == PriceActionAnalyzer.MomentumState.Accelerating ? "ACCELERATING" :
                                         _currentMSSQuality.Momentum == PriceActionAnalyzer.MomentumState.Steady ? "STEADY" :
                                         _currentMSSQuality.Momentum == PriceActionAnalyzer.MomentumState.Decelerating ? "DECELERATING" : "EXHAUSTED";

                    reasons.Add($"{mssIcon} MSS BREAK: {_currentMSSQuality.Quality} with {momentumText} momentum (Strength: {_currentMSSQuality.StrengthScore:F2}/1.0)");
                    reasons.Add($"   {_currentMSSQuality.Reasoning}");
                }

                // Pullback Quality
                if (_currentPullbackQuality != null)
                {
                    string pbIcon = _currentPullbackQuality.Quality == PriceActionAnalyzer.MoveQuality.Corrective ? "✅" :
                                   _currentPullbackQuality.Quality == PriceActionAnalyzer.MoveQuality.WeakCorrective ? "⚠️" :
                                   _currentPullbackQuality.Quality == PriceActionAnalyzer.MoveQuality.Neutral ? "⚠️" :
                                   _currentPullbackQuality.Quality == PriceActionAnalyzer.MoveQuality.Impulsive ? "❌" : "❌";

                    reasons.Add($"{pbIcon} PULLBACK: {_currentPullbackQuality.Quality} character (Strength: {_currentPullbackQuality.StrengthScore:F2}/1.0)");
                    reasons.Add($"   {_currentPullbackQuality.Reasoning}");
                }

                // Textbook setup bonus
                if (_currentMSSQuality != null && _currentPullbackQuality != null)
                {
                    if (_currentMSSQuality.Quality == PriceActionAnalyzer.MoveQuality.StrongImpulsive &&
                        _currentMSSQuality.Momentum == PriceActionAnalyzer.MomentumState.Accelerating &&
                        _currentPullbackQuality.Quality == PriceActionAnalyzer.MoveQuality.Corrective)
                    {
                        reasons.Add($"   🎯 TEXTBOOK SETUP: Strong impulsive break → Clean corrective pullback (+2% confidence bonus)");
                    }
                }
            }

            // 11. Final Decision Explanation
            string decision;
            if (finalConfidence >= 0.8)
                decision = "🚀 HIGH CONVICTION - Take large position (1.5× risk)";
            else if (finalConfidence >= 0.6)
                decision = "✅ STANDARD SETUP - Take normal position (1.0× risk)";
            else if (finalConfidence >= 0.4)
                decision = "⚠️ MARGINAL SETUP - Take reduced position (0.5× risk)";
            else
                decision = "❌ LOW QUALITY - Take minimum position (0.5× risk) or skip";

            reasons.Add($"→ {decision}");

            // Combine all reasons
            return string.Join(" | ", reasons);
        }

        private BiasDirection GetBiasForTf(TimeFrame tf)
        {
            try
            {
                if (tf == null || tf == default(TimeFrame)) return BiasDirection.Neutral;
                return _marketData.GetBias(tf);
            }
            catch { return BiasDirection.Neutral; }
        }

        private bool IsAtSwingExtreme(BiasDirection proBias)
        {
            // Delegate to SwingDetector for last closed bar
            if (Bars == null || Bars.Count < 7) return false;
            int i = Bars.Count - 2; // last closed
            int pivot = 3;
            var highs = Bars.HighPrices.Select(x => (double)x).ToList();
            var lows  = Bars.LowPrices.Select(x => (double)x).ToList();
            bool atHigh = CCTTB.MSS.Core.Detectors.SwingDetector.IsSwingHigh(highs, i, pivot, true);
            bool atLow  = CCTTB.MSS.Core.Detectors.SwingDetector.IsSwingLow (lows,  i, pivot, true);
            if (proBias == BiasDirection.Bullish && atHigh) return true;
            if (proBias == BiasDirection.Bearish && atLow)  return true;
            return false;
        }
        private bool TryOverlap(double aLo, double aHi, double bLo, double bHi, double expand, out double oLo, out double oHi)
        {
            double lo1 = Math.Min(aLo, aHi), hi1 = Math.Max(aLo, aHi);
            double lo2 = Math.Min(bLo, bHi), hi2 = Math.Max(bLo, bHi);
            double lo = Math.Max(lo1, lo2) - expand;
            double hi = Math.Min(hi1, hi2) + expand;
            oLo = lo; oHi = hi;
            return lo <= hi;
        }


        private void EnsureBarsLoaded(TimeFrame tf)
        {
            if (tf == null || tf == default(TimeFrame)) return;
            try { var _ = MarketData.GetBars(tf); } catch { }
        }

        private Color ParseColor(string colorName)
        {
            switch (colorName?.ToLower())
            {
                case "green": return Color.Green;
                case "red": return Color.Red;
                case "blue": return Color.Blue;
                case "yellow": return Color.Yellow;
                case "gold": return Color.Gold;
                case "goldenrod": return Color.Goldenrod;
                case "grey": return Color.Gray;
                case "lightskyblue": return Color.LightSkyBlue;
                case "deepskyblue": return Color.DeepSkyBlue;
                case "slategray": return Color.SlateGray;
                case "mediumpurple": return Color.MediumPurple;
                default: return Color.Gray;
            }
        }

        private (VerticalAlignment v, HorizontalAlignment h) ParseAlignment(string pos)
        {
            string p = (pos ?? "TopCenter").Trim().ToLower();
            return p switch
            {
                "topleft" => (VerticalAlignment.Top, HorizontalAlignment.Left),
                "topcenter" => (VerticalAlignment.Top, HorizontalAlignment.Center),
                "topright" => (VerticalAlignment.Top, HorizontalAlignment.Right),
                "bottomleft" => (VerticalAlignment.Bottom, HorizontalAlignment.Left),
                "bottomcenter" => (VerticalAlignment.Bottom, HorizontalAlignment.Center),
                "bottomright" => (VerticalAlignment.Bottom, HorizontalAlignment.Right),
                _ => (VerticalAlignment.Top, HorizontalAlignment.Center)
            };
        }

        private void ApplyProfileOverrides()
        {
            try
            {
                switch (_config.ProfilePreset)
                {
                    case ProfilePresetEnum.IntradayBias:
                        _config.EnableIntradayBias = true;
                        _config.EnableWeeklyAccumulationBias = false;
                        _config.EnablePO3 = false;
                        _config.StrictOteAfterMssCompletion = true;
                        _config.PoiPriorityOrder = "OTE";
                        _config.EnableContinuationReanchorOTE = false;
                        _config.EnableSweepMssOte = false;
                        _config.RequireInternalSweep = true;
                        _config.RequirePOIKeyLevelInteraction = true;
                        _config.RequireMSSandOTE = true;

                        break;
                    case ProfilePresetEnum.WeeklyAccumulation:
                        _config.EnableIntradayBias = false;
                        _config.EnableWeeklyAccumulationBias = true;
                        _config.EnablePO3 = false;
                        _config.StrictOteAfterMssCompletion = true;
                        _config.PoiPriorityOrder = "OTE";
                        _config.EnableContinuationReanchorOTE = false;
                        _config.EnableSweepMssOte = false;
                        _config.RequireInternalSweep = false; // weekly sweeps are external
                        _config.RequirePOIKeyLevelInteraction = true;
                        _config.RequireMSSandOTE = true;

                        break;
                    case ProfilePresetEnum.PO3_Strict:
                        _config.EnableIntradayBias = false;
                        _config.EnableWeeklyAccumulationBias = false;
                        _config.EnablePO3 = true;
                        _config.RequireAsiaSweepBeforeEntry = true;
                        _config.StrictOteAfterMssCompletion = true;
                        _config.PoiPriorityOrder = "OTE";
                        _config.EnableContinuationReanchorOTE = false;
                        _config.EnableSweepMssOte = false;
                        _config.RequireInternalSweep = false; // PD/Asia driven
                        _config.RequirePOIKeyLevelInteraction = true;
                        _config.RequireMSSandOTE = true;
                        
                        break;
                    case ProfilePresetEnum.None:
                    default:
                        break;
                }
            }
            catch { }
        }

        private TimeSpan ParseTimeOrDefault(string s, TimeSpan d)
        {
            TimeSpan t;
            return TimeSpan.TryParse(s, out t) ? t : d;
        }

        private bool IsWithinBlackout(TimeSpan tod, string windows)
        {
            try
            {
                if (string.IsNullOrWhiteSpace(windows)) return false;
                var parts = windows.Split(new[] { ';' }, StringSplitOptions.RemoveEmptyEntries);
                foreach (var p in parts)
                {
                    var se = p.Trim().Split('-');
                    if (se.Length != 2) continue;
                    if (TimeSpan.TryParse(se[0], out var s) && TimeSpan.TryParse(se[1], out var e))
                    {
                        if (tod >= s && tod <= e) return true;
                    }
                }
            }
            catch { }
            return false;
        }

        private void UpdateAsiaState()
        {
            try
            {
                if (Bars == null || Bars.Count < 5) return;
                var _off = TimeSpan.FromHours(GetSessionOffsetHours(Server.Time));
                var todaySess = (Server.Time + _off).Date;
                var asiaStart = (todaySess + _config.AsiaStart) - _off;
                var asiaEnd = (todaySess + _config.AsiaEnd) - _off;
                if (_state.AsiaStartToday != asiaStart || _state.AsiaEndToday != asiaEnd)
                {
                    _state.AsiaStartToday = asiaStart;
                    _state.AsiaEndToday = asiaEnd;
                    _state.AsiaHigh = double.NaN;
                    _state.AsiaLow = double.NaN;
                    _state.AsiaSweepDir = 0;
                    _state.AsiaSweepBarIndex = -1;
                    _state.AsiaRangeTooWide = false;
                }
                // compute Asia H/L from bars within window
                double hi = double.MinValue, lo = double.MaxValue;
                int firstIdx = -1, lastIdx = -1;
                for (int i = Math.Max(0, Bars.Count - 600); i < Bars.Count; i++)
                {
                    var t = Bars.OpenTimes[i];
                    if (t >= _state.AsiaStartToday && t <= _state.AsiaEndToday)
                    {
                        if (firstIdx == -1) firstIdx = i;
                        lastIdx = i;
                        hi = Math.Max(hi, Bars.HighPrices[i]);
                        lo = Math.Min(lo, Bars.LowPrices[i]);
                    }
                }
                if (firstIdx >= 0)
                {
                    _state.AsiaHigh = hi;
                    _state.AsiaLow = lo;
                    // ADR guard: Asia range must not exceed configured % of ADR
                    try
                    {
                        if (_config.AdrPeriod > 0 && _config.AsiaRangeMaxAdrPct > 0)
                        {
                            var dBars = MarketData.GetBars(TimeFrame.Daily, Symbol.Name);
                            if (dBars != null && dBars.Count >= _config.AdrPeriod + 1)
                            {
                                double sum = 0; int n = _config.AdrPeriod;
                                for (int k = dBars.Count - n - 1; k < dBars.Count - 1; k++)
                                    sum += (dBars.HighPrices[k] - dBars.LowPrices[k]);
                                double adr = sum / n;
                                double asiaRange = Math.Max(0.0, hi - lo);
                                double maxRange = (_config.AsiaRangeMaxAdrPct / 100.0) * adr;
                                _state.AsiaRangeTooWide = (asiaRange > maxRange);
                            }
                        }
                    }
                    catch { }
                    // Detect sweep after Asia window
                    int startScan = Math.Max(lastIdx + 1, 0);
                    int endScan = Bars.Count - 2; // closed bars only
                    int look = Math.Max(10, _config.PO3LookbackBars);
                    startScan = Math.Max(startScan, endScan - look);
                    int sweepDir = 0; int sweepIdx = -1;
                    double eps = Symbol.PipSize * Math.Max(0.5, _config.TapTolerancePips);
                    for (int i = endScan; i >= startScan; i--)
                    {
                        if (!double.IsNaN(_state.AsiaHigh) && Bars.HighPrices[i] > _state.AsiaHigh + eps)
                        { sweepDir = +1; sweepIdx = i; break; }
                        if (!double.IsNaN(_state.AsiaLow) && Bars.LowPrices[i] < _state.AsiaLow - eps)
                        { sweepDir = -1; sweepIdx = i; break; }
                    }
                    if (sweepDir != 0)
                    {
                        _state.AsiaSweepDir = sweepDir;
                        _state.AsiaSweepBarIndex = sweepIdx;
                    }
                }
            }
            catch { }
        }

        private bool IsWithinTradeWindow(TimeSpan tod, string windows)
        {
            try
            {
                if (string.IsNullOrWhiteSpace(windows)) return false;
                var parts = windows.Split(new[] { ';' }, StringSplitOptions.RemoveEmptyEntries);
                foreach (var p in parts)
                {
                    var se = p.Trim().Split('-');
                    if (se.Length != 2) continue;
                    if (TimeSpan.TryParse(se[0], out var s) && TimeSpan.TryParse(se[1], out var e))
                    {
                        if (tod >= s && tod <= e) return true;
                    }
                }
            }
            catch { }
            return false;
        }

        private BiasDirection? GetPo3PreferredDirection()
        {
            if (_state.AsiaRangeTooWide) return null;
            if (_state.AsiaSweepDir == +1) return BiasDirection.Bearish; // swept above Asia high => distribution down
            if (_state.AsiaSweepDir == -1) return BiasDirection.Bullish; // swept below Asia low => distribution up
            return null;
        }

        // Intraday bias inferred from frames: after day open, if we take sell-side liquidity and then print a shift (on TF),
        // prefer longs for the day; inverse for buy-side.
        private BiasDirection? GetIntradayPreferredDirection(System.Collections.Generic.List<LiquiditySweep> sweeps)
        {
            try
            {
                if (!_config.EnableIntradayBias) return null;
                if (sweeps == null || sweeps.Count == 0) return null;
                DateTime dayOpen = Server.Time.Date; // Robot timezone already EST via [Robot(TimeZone=...)]

                // last accepted sweep since day open
                LiquiditySweep last = null;
                for (int i = sweeps.Count - 1; i >= 0; i--)
                {
                    if (sweeps[i].Time >= dayOpen) { last = sweeps[i]; break; }
                }
                if (last == null) return null;

                var dir = last.IsBullish ? BiasDirection.Bullish : BiasDirection.Bearish;

                // Require a confirming shift (MSS-like close beyond previous bar) on configured TF after the sweep
                if (!ConfirmShiftOnTf(dir, _config.IntradayBiasTimeFrame, last.Time)) return null;

                return dir;
            }
            catch { return null; }
        }

        private bool ConfirmShiftOnTf(BiasDirection dir, TimeFrame tf, DateTime sinceTime)
        {
            try
            {
                var tfBars = MarketData.GetBars(tf);
                if (tfBars == null || tfBars.Count < 3) return false;
                // find index after sinceTime
                int start = 1;
                for (int i = 1; i < tfBars.Count; i++) { if (tfBars.OpenTimes[i] >= sinceTime) { start = i; break; } }
                for (int i = Math.Max(1, start); i < tfBars.Count; i++)
                {
                    bool bullBreak = tfBars.ClosePrices[i] > tfBars.HighPrices[i - 1];
                    bool bearBreak = tfBars.ClosePrices[i] < tfBars.LowPrices[i - 1];
                    if ((dir == BiasDirection.Bullish && bullBreak) || (dir == BiasDirection.Bearish && bearBreak))
                        return true;
                }
                return false;
            }
            catch { return false; }
        }

        private bool ZoneTouchesKeyLevels(double zLo, double zHi, double tolAbs)
        {
            try
            {
                double lo = Math.Min(zLo, zHi) - Math.Abs(tolAbs);
                double hi = Math.Max(zLo, zHi) + Math.Abs(tolAbs);
                var zones = _marketData.GetLiquidityZones();
                if (zones == null) return false;
                foreach (var z in zones)
                {
                    string L = (z.Label ?? "").ToUpperInvariant();
                    bool isPd = (L == "PDH" || L == "PDL");
                    bool isCd = (L == "CDH" || L == "CDL");
                    bool isEq = (L == "EQH" || L == "EQL");
                    bool isWk = (L == "PWH" || L == "PWL");
                    if ((isPd && !_config.KeyValidUsePDH_PDL) ||
                        (isCd && !_config.KeyValidUseCDH_CDL) ||
                        (isEq && !_config.KeyValidUseEQH_EQL) ||
                        (isWk && !_config.KeyValidUsePWH_PWL))
                        continue;
                    bool isKey = isPd || isCd || isEq || isWk;
                    if (!isKey) continue;
                    double kLo = Math.Min(z.Low, z.High);
                    double kHi = Math.Max(z.Low, z.High);
                    if (!(kHi < lo || kLo > hi)) return true; // overlap
                }
                return false;
            }
            catch { return false; }
        }

        // Compute Monday/Tuesday range (current week, EST) on the current symbol using main Bars series.
        // Returns true if a range was found; outputs high/low and start/end times for the Mon/Tue window.
        private bool TryGetMonTueRange(out double hi, out double lo, out DateTime tStart, out DateTime tEnd)
        {
            hi = lo = 0; tStart = tEnd = default;
            try
            {
                var b = Bars; if (b == null || b.Count < 50) return false;
                // Start of this week = Monday 00:00 in server time
                DateTime today = Server.Time.Date;
                int daysSinceMonday = ((int)today.DayOfWeek + 6) % 7; // Monday=0
                DateTime monday = today.AddDays(-daysSinceMonday);
                tStart = monday;
                tEnd = monday.AddDays(2); // Mon/Tue inclusive window ends at Wed 00:00
                double _hi = double.MinValue, _lo = double.MaxValue; bool found = false;
                for (int i = 0; i < b.Count; i++)
                {
                    var t = b.OpenTimes[i];
                    if (t < tStart || t >= tEnd) continue;
                    if (b.HighPrices[i] > _hi) _hi = b.HighPrices[i];
                    if (b.LowPrices[i] < _lo) _lo = b.LowPrices[i];
                    found = true;
                }
                if (!found || _hi <= 0 || _lo <= 0 || _hi <= _lo) return false;
                hi = _hi; lo = _lo; return true;
            }
            catch { return false; }
        }

        private BiasDirection? GetWeeklyAccumPreferredDirection()
        {
            try
            {
                if (!_config.EnableWeeklyAccumulationBias) return null;
                if (!TryGetMonTueRange(out var rHi, out var rLo, out var tStart, out var tEnd)) return null;
                // After the Mon/Tue window, watch for sweep beyond the range and a confirming shift on configured TF
                // Bullish bias if we took the sell-side (below range low) then shifted up; Bearish if buy-side then shifted down
                // Find first cross time after tEnd
                DateTime crossTime = DateTime.MinValue; int crossDir = 0; // +1 over hi, -1 below lo
                var b = Bars; if (b == null || b.Count < 3) return null;
                for (int i = 1; i < b.Count; i++)
                {
                    var t = b.OpenTimes[i];
                    if (t <= tEnd) continue;
                    if (b.HighPrices[i] > rHi) { crossTime = t; crossDir = +1; break; }
                    if (b.LowPrices[i] < rLo) { crossTime = t; crossDir = -1; break; }
                }
                if (crossDir == 0) return null;
                var want = (crossDir == -1) ? BiasDirection.Bullish : BiasDirection.Bearish;
                if (!ConfirmShiftOnTf(want, _config.WeeklyAccumShiftTimeFrame, crossTime)) return null;
                return want;
            }
            catch { return null; }
        }

        // Simple compact range detection used for Ping-Pong TP assistance (last N bars in TF)
        private bool TryGetCompactRange(TimeFrame tf, int lookbackBars, double maxRangePips, out double hi, out double lo)
        {
            hi = lo = 0; try
            {
                var b = MarketData.GetBars(tf);
                if (b == null || b.Count < lookbackBars + 5) return false;
                int start = Math.Max(0, b.Count - lookbackBars);
                double _hi = double.MinValue, _lo = double.MaxValue;
                for (int i = start; i < b.Count; i++) { if (b.HighPrices[i] > _hi) _hi = b.HighPrices[i]; if (b.LowPrices[i] < _lo) _lo = b.LowPrices[i]; }
                double rngPips = (_hi - _lo) / Symbol.PipSize;
                if (rngPips <= Math.Max(1.0, maxRangePips)) { hi = _hi; lo = _lo; return true; }
                return false;
            }
            catch { return false; }
        }

        private bool TryGetLatestInternalSwing(bool isBull, out double price)
        {
            price = 0;
            try
            {
                var b = Bars; if (b == null || b.Count < 10) return false;
                DateTime dayOpen = Server.Time.Date;
                int start = 0; for (int i = 0; i < b.Count; i++) { if (b.OpenTimes[i] >= dayOpen) { start = i; break; } }
                int pivot = 3;
                if (isBull)
                {
                    for (int i = b.Count - pivot - 2; i >= Math.Max(start + pivot, 2); i--)
                    {
                        if (CCTTB.MSS.Core.Detectors.SwingDetector.IsSwingLow(b.LowPrices.Select(x => (double)x).ToList(), i, pivot, true))
                        { price = b.LowPrices[i]; return true; }
                    }
                }
                else
                {
                    for (int i = b.Count - pivot - 2; i >= Math.Max(start + pivot, 2); i--)
                    {
                        if (CCTTB.MSS.Core.Detectors.SwingDetector.IsSwingHigh(b.HighPrices.Select(x => (double)x).ToList(), i, pivot, true))
                        { price = b.HighPrices[i]; return true; }
                    }
                }
                return false;
            }
            catch { return false; }
        }

        private bool? ComputeSmtSignal(string compareSymbol, TimeFrame tf, int pivot)
        {
            try
            {
                var b1 = Bars; if (b1 == null || b1.Count < 10) return null;
                var b2 = MarketData.GetBars(tf, compareSymbol);
                if (b2 == null || b2.Count < 10) return null;
                // last closed indices
                int i1 = b1.Count - 2; int i2 = b2.Count - 2;
                // recent two swing highs/lows on both
                (double? hh1, double? ll1) = FindRecentSwings(b1, pivot);
                (double? hh2, double? ll2) = FindRecentSwings(b2, pivot);
                if (hh1.HasValue && hh2.HasValue)
                {
                    // bearish SMT: instrument makes HH while compare does not
                    bool instHH = MadeHigherHigh(b1, pivot);
                    bool compHH = MadeHigherHigh(b2, pivot);
                    if (instHH && !compHH) return false; // bearish
                }
                if (ll1.HasValue && ll2.HasValue)
                {
                    // bullish SMT: instrument makes LL while compare does not
                    bool instLL = MadeLowerLow(b1, pivot);
                    bool compLL = MadeLowerLow(b2, pivot);
                    if (instLL && !compLL) return true; // bullish
                }
            }
            catch { }
            return null;
        }

        private static (double? hh, double? ll) FindRecentSwings(Bars b, int pivot)
        {
            double? hh = null, ll = null;
            for (int i = b.Count - pivot - 2; i >= Math.Max(2, b.Count - 150); i--)
            {
                bool isHigh = true, isLow = true;
                for (int k = 1; k <= pivot; k++)
                {
                    if (b.HighPrices[i] <= b.HighPrices[i - k] || b.HighPrices[i] <= b.HighPrices[i + k]) isHigh = false;
                    if (b.LowPrices[i]  >= b.LowPrices[i - k]  || b.LowPrices[i]  >= b.LowPrices[i + k])  isLow = false;
                    if (!isHigh && !isLow) break;
                }
                if (isHigh && hh == null) hh = b.HighPrices[i];
                if (isLow  && ll == null) ll = b.LowPrices[i];
                if (hh != null && ll != null) break;
            }
            return (hh, ll);
        }

        private static bool MadeHigherHigh(Bars b, int pivot)
        {
            for (int i = b.Count - pivot - 2; i >= Math.Max(4, b.Count - 60); i--)
            {
                bool isHigh = true;
                for (int k = 1; k <= pivot; k++)
                    if (b.HighPrices[i] <= b.HighPrices[i - k] || b.HighPrices[i] <= b.HighPrices[i + k]) { isHigh = false; break; }
                if (!isHigh) continue;
                // compare to previous swing high
                for (int j = i - pivot - 1; j >= Math.Max(2, i - 50); j--)
                {
                    bool prevHigh = true;
                    for (int k = 1; k <= pivot; k++)
                        if (b.HighPrices[j] <= b.HighPrices[j - k] || b.HighPrices[j] <= b.HighPrices[j + k]) { prevHigh = false; break; }
                    if (prevHigh) return b.HighPrices[i] > b.HighPrices[j];
                }
            }
            return false;
        }

        private static bool MadeLowerLow(Bars b, int pivot)
        {
            for (int i = b.Count - pivot - 2; i >= Math.Max(4, b.Count - 60); i--)
            {
                bool isLow = true;
                for (int k = 1; k <= pivot; k++)
                    if (b.LowPrices[i] >= b.LowPrices[i - k] || b.LowPrices[i] >= b.LowPrices[i + k]) { isLow = false; break; }
                if (!isLow) continue;
                for (int j = i - pivot - 1; j >= Math.Max(2, i - 50); j--)
                {
                    bool prevLow = true;
                    for (int k = 1; k <= pivot; k++)
                        if (b.LowPrices[j] >= b.LowPrices[j - k] || b.LowPrices[j] >= b.LowPrices[j + k]) { prevLow = false; break; }
                    if (prevLow) return b.LowPrices[i] < b.LowPrices[j];
                }
            }
            return false;
        }

        private bool PriceTouchesZone(double lo, double hi, double tol, Bars barsToUse = null)
        {
            double a = Math.Min(lo, hi), b = Math.Max(lo, hi);
            // live price
            double priceMid = (Symbol.Bid + Symbol.Ask) * 0.5;
            if (priceMid >= a - tol && priceMid <= b + tol) return true;
            // last bar overlap - use specified bars or default to Bars
            var bars = barsToUse ?? Bars;
            int i = bars.Count - 1;
            if (i >= 0)
            {
                double lastLow = bars.LowPrices[i];
                double lastHigh = bars.HighPrices[i];
                if (lastLow <= b + tol && lastHigh >= a - tol) return true;
            }
            return false;
        }

        // Removed: OTE-after-sweep fallback path (not part of video logic)

        private bool ConfirmBreak(BiasDirection dir)
        {
            // Require breaking previous candle extremum in entry direction
            // Uses configurable reference: previous candle or last opposite candle in lookback window.
            if (Bars == null || Bars.Count < 3) return true; // fail-open if not enough bars
            int i = Bars.Count - 1;      // current (forming) bar
            int p = Bars.Count - 2;      // last closed
            int pp = Bars.Count - 3;     // prior closed
            // Accept an already-confirmed break state within expiry window
            if (_state.BreakDir == dir && _state.BreakExpiryBar >= Bars.Count - 1 && _state.BreakBarIndex >= 0)
                return true;

            int refIdx = -1;
            if (_config.BreakReference == BreakRefMode.PrevCandle)
            {
                refIdx = pp;
            }
            else if (_config.BreakReference == BreakRefMode.LastOppositeCandle)
            {
                int start = Math.Max(1, p - Math.Max(1, _config.BreakLookbackBars));
                // find last opposite-colored candle before p
                for (int k = p - 1; k >= start; k--)
                {
                    bool isBullCandle = Bars.ClosePrices[k] >= Bars.OpenPrices[k];
                    if ((dir == BiasDirection.Bullish && !isBullCandle) || (dir == BiasDirection.Bearish && isBullCandle))
                    { refIdx = k; break; }
                }
                if (refIdx < 0) refIdx = pp; // fallback
            }

            if (dir == BiasDirection.Bullish)
            {
                bool ok = Bars.HighPrices[p] > Bars.HighPrices[refIdx];
                if (ok)
                {
                    _state.BreakDir = dir;
                    _state.BreakLevel = Bars.HighPrices[refIdx];
                    _state.BreakBarIndex = p;
                    _state.BreakExpiryBar = Bars.Count - 1 + Math.Max(3, _config.SequenceLookbackBars / 5);
                    if (_config.EnableDebugLogging) _journal.Debug($"ConfirmBreak Bullish: p={p} ref={refIdx} level={_state.BreakLevel:F5}");
                }
                else
                {
                    // Backfill: scan prior bars within lookback to capture a recent break we may have missed
                    int lookback = Math.Max(1, _config.BreakLookbackBars);
                    for (int k = p - 1; k >= Math.Max(2, p - lookback); k--)
                    {
                        int refK = -1;
                        if (_config.BreakReference == BreakRefMode.PrevCandle)
                            refK = k - 1;
                        else if (_config.BreakReference == BreakRefMode.LastOppositeCandle)
                        {
                            int start = Math.Max(1, k - Math.Max(1, _config.BreakLookbackBars));
                            for (int t = k - 1; t >= start; t--)
                            {
                                bool isBullCandle = Bars.ClosePrices[t] >= Bars.OpenPrices[t];
                                if (!isBullCandle) { refK = t; break; }
                            }
                            if (refK < 0) refK = k - 1;
                        }
                        if (refK >= 0 && Bars.HighPrices[k] > Bars.HighPrices[refK])
                        {
                            _state.BreakDir = dir;
                            _state.BreakLevel = Bars.HighPrices[refK];
                            _state.BreakBarIndex = k;
                            _state.BreakExpiryBar = Bars.Count - 1 + Math.Max(3, _config.SequenceLookbackBars / 5);
                            if (_config.EnableDebugLogging) _journal.Debug($"ConfirmBreak Bullish backfill: k={k} ref={refK} level={_state.BreakLevel:F5}");
                            return true;
                        }
                    }
                }
                return ok;
            }
            else if (dir == BiasDirection.Bearish)
            {
                bool ok = Bars.LowPrices[p] < Bars.LowPrices[refIdx];
                if (ok)
                {
                    _state.BreakDir = dir;
                    _state.BreakLevel = Bars.LowPrices[refIdx];
                    _state.BreakBarIndex = p;
                    _state.BreakExpiryBar = Bars.Count - 1 + Math.Max(3, _config.SequenceLookbackBars / 5);
                    if (_config.EnableDebugLogging) _journal.Debug($"ConfirmBreak Bearish: p={p} ref={refIdx} level={_state.BreakLevel:F5}");
                }
                else
                {
                    // Backfill: scan prior bars within lookback to capture a recent break we may have missed
                    int lookback = Math.Max(1, _config.BreakLookbackBars);
                    for (int k = p - 1; k >= Math.Max(2, p - lookback); k--)
                    {
                        int refK = -1;
                        if (_config.BreakReference == BreakRefMode.PrevCandle)
                            refK = k - 1;
                        else if (_config.BreakReference == BreakRefMode.LastOppositeCandle)
                        {
                            int start = Math.Max(1, k - Math.Max(1, _config.BreakLookbackBars));
                            for (int t = k - 1; t >= start; t--)
                            {
                                bool isBullCandle = Bars.ClosePrices[t] >= Bars.OpenPrices[t];
                                if (isBullCandle) { refK = t; break; }
                            }
                            if (refK < 0) refK = k - 1;
                        }
                        if (refK >= 0 && Bars.LowPrices[k] < Bars.LowPrices[refK])
                        {
                            _state.BreakDir = dir;
                            _state.BreakLevel = Bars.LowPrices[refK];
                            _state.BreakBarIndex = k;
                            _state.BreakExpiryBar = Bars.Count - 1 + Math.Max(3, _config.SequenceLookbackBars / 5);
                            if (_config.EnableDebugLogging) _journal.Debug($"ConfirmBreak Bearish backfill: k={k} ref={refK} level={_state.BreakLevel:F5}");
                            return true;
                        }
                    }
                }
                return ok;
            }
            return false;
        }

        private bool IsPullbackTap(BiasDirection dir, double zoneLo, double zoneHi)
        {
            if (!_config.RequirePullbackAfterBreak) return true;
            if (Bars == null || Bars.Count < 3) return true;

            // Always attempt to confirm a break on the last closed bar, independent of RequireMicroBreak.
            // This ensures we only accept taps that occur AFTER a real break, matching the MSS → pullback intent.
            ConfirmBreak(dir);

            // If no break has been recorded in this direction, do not allow entry yet.
            if (_state.BreakDir != dir || _state.BreakBarIndex < 0)
            {
                if (_config.EnableDebugLogging) _journal.Debug($"Pullback: no break recorded for {dir}");
                return false;
            }

            double pip = Symbol.PipSize;
            int p = Bars.Count - 2; // last closed bar index
            double mid = (Symbol.Bid + Symbol.Ask) * 0.5;
            double eps = Math.Max(0.0, _config.PullbackMinPips) * pip;
            double lo = Math.Min(zoneLo, zoneHi);
            double hi = Math.Max(zoneLo, zoneHi);

            // Require that we are evaluating AFTER the break bar
            bool afterBreak = (Bars.Count - 2 > _state.BreakBarIndex);
            if (!afterBreak)
            {
                if (_config.EnableDebugLogging) _journal.Debug($"Pullback: not after break idx={_state.BreakBarIndex} p={p}");
                return false;
            }

            if (dir == BiasDirection.Bullish)
            {
                if (double.IsNaN(_state.BreakLevel)) { if (_config.EnableDebugLogging) _journal.Debug("Pullback Bull: break level NaN"); return false; }
                double breakHigh = _state.BreakLevel;
                double minLevel = breakHigh - eps;
                // zone and current price must be below the break high by eps (a genuine pullback)
                bool ok = hi <= minLevel && mid <= minLevel;
                if (_config.EnableDebugLogging) _journal.Debug($"Pullback Bull: breakHigh={breakHigh:F5} eps={eps / pip:F2} zone=[{lo:F5},{hi:F5}] mid={mid:F5} -> {(ok ? "OK" : "BLOCK")}");
                return ok;
            }
            else if (dir == BiasDirection.Bearish)
            {
                if (double.IsNaN(_state.BreakLevel)) { if (_config.EnableDebugLogging) _journal.Debug("Pullback Bear: break level NaN"); return false; }
                double breakLow = _state.BreakLevel;
                double minLevel = breakLow + eps;
                // zone and current price must be above the break low by eps (a genuine pullback)
                bool ok = lo >= minLevel && mid >= minLevel;
                if (_config.EnableDebugLogging) _journal.Debug($"Pullback Bear: breakLow={breakLow:F5} eps={eps / pip:F2} zone=[{lo:F5},{hi:F5}] mid={mid:F5} -> {(ok ? "OK" : "BLOCK")}");
                return ok;
            }
            return false;
        }

        private bool ValidateSequenceGate(BiasDirection entryDir, List<LiquiditySweep> sweeps, List<MSSSignal> mssSignals, out int sweepIdx, out int mssIdx)
        {
            sweepIdx = -1; mssIdx = -1;
            _state.SequenceFallbackUsed = false; // last sequence validation used relaxed path
            if (!_config.EnableSequenceGate) return true;
            if (sweeps == null || sweeps.Count == 0 || mssSignals == null || mssSignals.Count == 0)
            {
                if (_config.EnableDebugLogging) _journal.Debug($"SequenceGate: sweeps={(sweeps?.Count ?? 0)} mss={(mssSignals?.Count ?? 0)} -> FALSE (no data)");
                return false;
            }
            // pick latest ACCEPTED sweep within lookback
            LiquiditySweep sw = null;
            for (int i = sweeps.Count - 1; i >= 0; i--)
            {
                if (AcceptSweepLabel(sweeps[i].Label)) { sw = sweeps[i]; break; }
            }
            if (sw == null)
            {
                if (_config.EnableDebugLogging) _journal.Debug("SequenceGate: no accepted sweep found -> FALSE");
                return false;
            }
            sweepIdx = FindBarIndexByTime(sw.Time);
            if (sweepIdx < 0)
            {
                if (_config.EnableDebugLogging) _journal.Debug($"SequenceGate: sweep time={sw.Time:HH:mm} not found in bars -> FALSE");
                return false;
            }
            if (Bars.Count - 1 - sweepIdx > Math.Max(1, _config.SequenceLookbackBars))
            {
                if (_config.EnableDebugLogging) _journal.Debug($"SequenceGate: sweep too old (bars ago={(Bars.Count - 1 - sweepIdx)} > lookback={_config.SequenceLookbackBars}) -> FALSE");
                return false;
            }
            // require MSS after sweep in same direction as entry
            int validMssCount = 0;
            int invalidMssCount = 0;
            int mssAfterSweepCount = 0;
            int mssWrongDirectionCount = 0;
            for (int i = mssSignals.Count - 1; i >= 0; i--)
            {
                var s = mssSignals[i];
                if (!s.IsValid)
                {
                    invalidMssCount++;
                    if (_config.EnableDebugLogging)
                        _journal.Debug($"[MSS DEBUG] MSS #{i} INVALID at {s.Time:HH:mm} dir={s.Direction}");
                    continue;
                }
                validMssCount++;

                // Check if MSS is after sweep
                if (s.Time <= sw.Time)
                {
                    if (_config.EnableDebugLogging)
                        _journal.Debug($"[MSS DEBUG] MSS #{i} BEFORE sweep at {s.Time:HH:mm} <= sweep {sw.Time:HH:mm} dir={s.Direction} - skipping older MSS");
                    break;
                }

                mssAfterSweepCount++;
                if (_config.EnableDebugLogging)
                    _journal.Debug($"[MSS DEBUG] MSS #{i} AFTER sweep at {s.Time:HH:mm} dir={s.Direction} (want {entryDir})");

                if (s.Direction == entryDir)
                {
                    mssIdx = FindBarIndexByTime(s.Time);
                    if (_config.EnableDebugLogging) _journal.Debug($"SequenceGate: found valid MSS dir={s.Direction} after sweep -> TRUE");
                    return mssIdx >= 0;
                }
                else
                {
                    mssWrongDirectionCount++;
                    if (_config.EnableDebugLogging)
                        _journal.Debug($"[MSS DEBUG] MSS #{i} WRONG DIRECTION: has {s.Direction}, need {entryDir}");
                }
            }

            if (_config.EnableDebugLogging)
                _journal.Debug($"[MSS DEBUG SUMMARY] Total MSS: {mssSignals.Count} | Valid: {validMssCount} | Invalid: {invalidMssCount} | After Sweep: {mssAfterSweepCount} | Wrong Direction: {mssWrongDirectionCount}");
            // Fallback: if explicitly allowed, relax to any recent MSS in entry direction within 2x lookback bars
            if (_config.AllowSequenceGateFallback)
            {
                int look = Math.Max(1, _config.SequenceLookbackBars * 2);
                for (int i = mssSignals.Count - 1; i >= 0; i--)
                {
                    var s = mssSignals[i]; if (!s.IsValid) continue;
                    if (s.Direction != entryDir) continue;
                    int idx = FindBarIndexByTime(s.Time);
                    if (idx >= 0 && Bars.Count - 1 - idx <= look)
                    {
                        mssIdx = idx; _state.SequenceFallbackUsed = true;
                        if (_config.EnableDebugLogging) _journal.Debug($"SequenceGate: fallback found valid MSS dir={s.Direction} within {look} bars -> TRUE");
                        return true;
                    }
                }

                // CRITICAL FIX (Oct 25): Ultimate fallback - if no matching direction MSS, accept ANY recent MSS
                // This prevents complete trade blocking when bias flips but old MSS persists
                if (validMssCount > 0)
                {
                    for (int i = mssSignals.Count - 1; i >= 0; i--)
                    {
                        var s = mssSignals[i];
                        if (!s.IsValid) continue;
                        int idx = FindBarIndexByTime(s.Time);
                        if (idx >= 0 && Bars.Count - 1 - idx <= look * 2) // Even more relaxed window
                        {
                            mssIdx = idx;
                            _state.SequenceFallbackUsed = true;
                            if (_config.EnableDebugLogging)
                                _journal.Debug($"SequenceGate: ULTIMATE fallback - accepting ANY MSS dir={s.Direction} (wanted {entryDir}) within {look*2} bars -> TRUE (direction mismatch override)");
                            return true;
                        }
                    }
                }
            }
            if (_config.EnableDebugLogging) _journal.Debug($"SequenceGate: no valid MSS found (valid={validMssCount} invalid={invalidMssCount} entryDir={entryDir}) -> FALSE");
            return false;
        }

        // ═══════════════════════════════════════════════════════════════════════════════
        // OCT 30 ENHANCEMENT #2: ENTRY TIMING/CONFIRMATION VALIDATION
        // ═══════════════════════════════════════════════════════════════════════════════
        /// <summary>
        /// Validate entry confirmation logic to prevent premature/weak entries.
        /// Checks: Price inside POI zone, MSS momentum quality, wait time after OTE tap.
        /// </summary>
        private bool ValidateEntryConfirmation(TradeSignal signal, double currentPrice)
        {
            if (!_config.RequireEntryConfirmation)
                return true; // Feature disabled

            // CONFIRMATION #1: Price must be INSIDE the POI zone (not just touching)
            bool insideZone = false;
            double tolerance = 2 * Symbol.PipSize; // 2 pip tolerance

            if (signal.Direction == BiasDirection.Bullish)
            {
                // Bullish: Current price should be AT or BELOW entry (not above)
                insideZone = currentPrice <= signal.EntryPrice + tolerance;
            }
            else
            {
                // Bearish: Current price should be AT or ABOVE entry (not below)
                insideZone = currentPrice >= signal.EntryPrice - tolerance;
            }

            if (!insideZone)
            {
                if (_config.EnableDebugLogging)
                    _journal.Debug($"[ENTRY CONFIRMATION] ❌ REJECTED: Price outside entry zone | Current={currentPrice:F5} Entry={signal.EntryPrice:F5} Direction={signal.Direction}");
                return false;
            }

            // CONFIRMATION #2: MSS must have proper momentum (not corrective)
            if (_currentMSSQuality != null && _config.BlockCorrectiveMSS)
            {
                if (_currentMSSQuality.Quality == PriceActionAnalyzer.MoveQuality.Corrective ||
                    _currentMSSQuality.Quality == PriceActionAnalyzer.MoveQuality.WeakCorrective)
                {
                    if (_config.EnableDebugLogging)
                        _journal.Debug($"[ENTRY CONFIRMATION] ❌ REJECTED: Corrective MSS break (Quality={_currentMSSQuality.Quality}, not impulsive)");
                    return false;
                }
            }

            // CONFIRMATION #3: Wait 1-2 bars after OTE tap (no immediate entry)
            // Note: Using ActiveOTETime instead of LastOteBarIndex (not in LocalState)
            if (_state.ActiveOTETime != DateTime.MinValue)
            {
                TimeSpan timeSinceOTE = Server.Time - _state.ActiveOTETime;
                double minutesSinceOTE = timeSinceOTE.TotalMinutes;
                int estimatedBarsSinceOTE = (int)(minutesSinceOTE / 5); // Assuming M5 timeframe (5 min per bar)

                if (estimatedBarsSinceOTE < _config.MinBarsAfterOTE)
                {
                    if (_config.EnableDebugLogging)
                        _journal.Debug($"[ENTRY CONFIRMATION] ❌ REJECTED: Too soon after OTE tap (estimated bars={estimatedBarsSinceOTE}, need {_config.MinBarsAfterOTE}+)");
                    return false;
                }
            }

            if (_config.EnableDebugLogging)
                _journal.Debug($"[ENTRY CONFIRMATION] ✅ PASSED: All confirmations met (zone OK, MSS OK, timing OK)");

            return true;
        }

        // ═══════════════════════════════════════════════════════════════════════════════
        // OCT 30 ENHANCEMENT #3: LOW-QUALITY SIGNAL FILTERING
        // ═══════════════════════════════════════════════════════════════════════════════
        /// <summary>
        /// Filter out low-quality signals based on MTF bias, intermarket analysis, and RR.
        /// Blocks: Weak MTF bias, intermarket conflicts, insufficient RR.
        /// </summary>
        private bool FilterLowQualitySignals(TradeSignal signal)
        {
            // FILTER #1: Block weak MTF bias (if MTF bias system is enabled)
            if (_mtfBias != null && _config.BlockWeakMTFBias && _currentBiasConfluence != null)
            {
                // Use BiasConfluence.Score instead of DailyContext.ConfluenceScore
                if (_currentBiasConfluence.Score < _config.MinMTFBiasScore)
                {
                    if (_config.EnableDebugLogging)
                        _journal.Debug($"[QUALITY FILTER] ❌ BLOCKED: Weak MTF bias (Score: {_currentBiasConfluence.Score}/{_config.MinMTFBiasScore} required)");
                    return false; // Block
                }
            }

            // FILTER #2: Block opposite intermarket signals (correlation conflicts)
            // Use intermarket confidence factor - negative factor means conflicting signal
            if (_intermarketAnalysis != null)
            {
                try
                {
                    double intermarketFactor = _intermarketAnalysis.GetIntermarketConfidenceFactor(signal.Direction);

                    // Negative factor means strong conflict with intermarket correlations
                    if (intermarketFactor < -0.3)  // Threshold: -0.3 means moderate conflict
                    {
                        if (_config.EnableDebugLogging)
                            _journal.Debug($"[QUALITY FILTER] ❌ BLOCKED: Intermarket conflict (Factor={intermarketFactor:F2}, threshold=-0.3)");
                        return false;
                    }
                }
                catch
                {
                    // Intermarket data not available - skip this filter
                }
            }

            // FILTER #3: Block signals with insufficient RR (< 1.5:1 minimum)
            if (signal.StopLoss != 0 && signal.TakeProfit != 0)
            {
                double slDistance = Math.Abs(signal.EntryPrice - signal.StopLoss);
                double tpDistance = Math.Abs(signal.TakeProfit - signal.EntryPrice);
                double actualRR = slDistance > 0 ? tpDistance / slDistance : 0;

                if (actualRR < 1.5)
                {
                    if (_config.EnableDebugLogging)
                        _journal.Debug($"[QUALITY FILTER] ❌ BLOCKED: RR too low (RR={actualRR:F2}, need 1.5+)");
                    return false;
                }

                if (_config.EnableDebugLogging)
                    _journal.Debug($"[QUALITY FILTER] ✅ RR check passed: {actualRR:F2}:1 (≥ 1.5:1)");
            }

            if (_config.EnableDebugLogging)
                _journal.Debug($"[QUALITY FILTER] ✅ PASSED: All quality checks met");

            return true; // Allow signal
        }

        private bool AcceptSweepLabel(string label)
        {
            var lbl = (label ?? string.Empty).ToUpperInvariant();
            if (_config.RequireInternalSweep)
            {
                // Only accept internal (swing) sweeps; reject PD/Weekly/Current Day tags
                if (lbl == "PDH" || lbl == "PDL" || lbl == "PWH" || lbl == "PWL" || lbl == "CDH" || lbl == "CDL" || lbl == "EQH" || lbl == "EQL")
                    return false;
                if (lbl.StartsWith("SWING")) return true;
            }
            if (_config.EnableWeeklySwingMode)
                return lbl == "PWH" || lbl == "PWL"; // weekly swing mode limits sweeps to weekly levels
            if (_config.RequirePdhPdlSweepOnly)
                return lbl == "PDH" || lbl == "PDL";
            // otherwise accept based on toggles
            if (lbl == "PDH" || lbl == "PDL") return true;
            // EQH/EQL: Accept if toggle enabled (maintains quality - only accept when these zones are actually valid on chart)
            if (_config.AllowEqhEqlSweeps && (lbl == "EQH" || lbl == "EQL")) return true;
            // Allow CDH/CDL sweeps during killzone (intraday video logic) even if toggle is off
            if ((lbl == "CDH" || lbl == "CDL"))
            {
                if (_config.EnableKillzoneGate)
                {
                    var tod = Server.Time.TimeOfDay;
                    if (IsWithinKillZone(tod, _config.KillZoneStart, _config.KillZoneEnd)) return true;
                }
                if (_config.AllowCdhCdlSweeps) return true;
            }
            if (_config.AllowWeeklySweeps && (lbl == "PWH" || lbl == "PWL")) return true;
            // SWING-labeled internal liquidity (always accepted as fallback if no other filters apply)
            if (lbl.StartsWith("SWING")) return true;
            return false;
        }

        // IFVG retest detection: scan recent FVGs, require full trade-through then retest opposite boundary
        private List<FVGZone> DeriveIfvgRetests(Bars bars, int maxScanBars = 200)
        {
            var ret = new List<FVGZone>();
            try
            {
                if (bars == null || bars.Count < 10) return ret;
                int end = bars.Count - 2; // closed bars only
                int start = Math.Max(2, end - Math.Max(50, maxScanBars));
                var highs = new List<double>(); var lows = new List<double>();
                for (int i = 0; i < bars.Count; i++) { highs.Add(bars.HighPrices[i]); lows.Add(bars.LowPrices[i]); }

                for (int i = start; i <= end - 1; i++)
                {
                    var bull = CCTTB.MSS.Core.Detectors.FVGDetector.GapBoundsBullish(highs, lows, i, minGap: 0.0);
                    if (bull.HasValue)
                    {
                        double lo = bull.Value.low, hi = bull.Value.high; // [lo..hi]
                        // inversion: a later candle closes below lo
                        bool inverted = false; int invIdx = -1;
                        for (int k = i + 2; k <= end; k++) { if (bars.ClosePrices[k] < lo) { inverted = true; invIdx = k; break; } }
                        if (inverted)
                        {
                            // retest the opposite boundary (hi) later
                            for (int k = invIdx + 1; k <= end; k++)
                            {
                                if (bars.LowPrices[k] <= hi && bars.HighPrices[k] >= hi)
                                {
                                    ret.Add(new FVGZone { Time = bars.OpenTimes[k], Direction = BiasDirection.Bearish, Low = Math.Min(lo, hi), High = Math.Max(lo, hi) });
                                    break;
                                }
                            }
                        }
                    }
                    var bear = CCTTB.MSS.Core.Detectors.FVGDetector.GapBoundsBearish(highs, lows, i, minGap: 0.0);
                    if (bear.HasValue)
                    {
                        double lo = bear.Value.low, hi = bear.Value.high;
                        // inversion: a later candle closes above hi
                        bool inverted = false; int invIdx = -1;
                        for (int k = i + 2; k <= end; k++) { if (bars.ClosePrices[k] > hi) { inverted = true; invIdx = k; break; } }
                        if (inverted)
                        {
                            // retest the opposite boundary (lo)
                            for (int k = invIdx + 1; k <= end; k++)
                            {
                                if (bars.LowPrices[k] <= lo && bars.HighPrices[k] >= lo)
                                {
                                    ret.Add(new FVGZone { Time = bars.OpenTimes[k], Direction = BiasDirection.Bullish, Low = Math.Min(lo, hi), High = Math.Max(lo, hi) });
                                    break;
                                }
                            }
                        }
                    }
                }
            }
            catch { }
            return ret;
        }

        private double? FindOppositeLiquidityTarget(bool isBull, double entryPrice)
        {
            try
            {
                var zones = _marketData.GetLiquidityZones();
                if (zones == null || zones.Count == 0) return null;
                if (isBull)
                {
                    double best = double.MaxValue; bool found = false;
                    foreach (var z in zones)
                    {
                        if (z.Type != LiquidityZoneType.Supply) continue;
                        double tgt = z.High;
                        if (tgt > entryPrice && tgt < best) { best = tgt; found = true; }
                    }
                    return found ? (double?)best : null;
                }
                else
                {
                    double best = double.MinValue; bool found = false;
                    foreach (var z in zones)
                    {
                        if (z.Type != LiquidityZoneType.Demand) continue;
                        double tgt = z.Low;
                        if (tgt < entryPrice && tgt > best) { best = tgt; found = true; }
                    }
                    return found ? (double?)best : null;
                }
            }
            catch { return null; }
        }

        private double? FindOppositeLiquidityTargetWithMinRR(bool isBull, double entryPrice, double stopPips, double minRR)
        {
            try
            {
                var zones = _marketData.GetLiquidityZones();
                if (zones == null) zones = new System.Collections.Generic.List<LiquidityZone>();
                double pip = Symbol.PipSize;
                double requiredPips = Math.Max(0.0, minRR) * Math.Max(0.0, stopPips);

                // Collect candidate target prices (custom first, then zone scan)
                var candidates = new System.Collections.Generic.List<double>();

                // PRIORITY 1: MSS Opposite Liquidity Level (from lifecycle tracking)
                // This is the liquidity that was identified when the MSS was locked
                if (_state.OppositeLiquidityLevel > 0)
                {
                    // Verify it's in the correct direction for the trade
                    bool validDirection = isBull ? (_state.OppositeLiquidityLevel > entryPrice) : (_state.OppositeLiquidityLevel < entryPrice);
                    if (validDirection)
                    {
                        candidates.Add(_state.OppositeLiquidityLevel);
                        if (_config.EnableDebugLogging)
                            _journal.Debug($"TP Target: MSS OppLiq={_state.OppositeLiquidityLevel:F5} added as PRIORITY candidate | Entry={entryPrice:F5} | Direction={( isBull ? "LONG" : "SHORT")} | Valid={validDirection}");
                    }
                    else
                    {
                        if (_config.EnableDebugLogging)
                            _journal.Debug($"TP Target: MSS OppLiq={_state.OppositeLiquidityLevel:F5} REJECTED (wrong direction) | Entry={entryPrice:F5} | Direction={( isBull ? "LONG" : "SHORT")} | Need {(isBull ? "ABOVE" : "BELOW")} entry");
                    }
                }

                // CHANGE #3: PRIORITY 2 - HTF LIQUIDITY TARGETS (OCT 30, 2025)
                // Prioritize Daily/H4 PDH/PDL levels over lower timeframe targets
                int htfCandidatesAdded = 0;
                foreach (var z in zones)
                {
                    bool isHTFLevel = z.Label != null && (z.Label.Contains("PDH") || z.Label.Contains("PDL") ||
                                                           z.Label.Contains("Daily") || z.Label.Contains("H4"));
                    if (isHTFLevel)
                    {
                        if (isBull && z.Type == LiquidityZoneType.Supply)
                        {
                            candidates.Add(z.High);
                            htfCandidatesAdded++;
                            if (_config.EnableDebugLogging)
                                _journal.Debug($"TP Target: HTF {z.Label} Supply={z.High:F5} added as HIGH PRIORITY (Daily/H4)");
                        }
                        else if (!isBull && z.Type == LiquidityZoneType.Demand)
                        {
                            candidates.Add(z.Low);
                            htfCandidatesAdded++;
                            if (_config.EnableDebugLogging)
                                _journal.Debug($"TP Target: HTF {z.Label} Demand={z.Low:F5} added as HIGH PRIORITY (Daily/H4)");
                        }
                    }
                }
                if (_config.EnableDebugLogging && htfCandidatesAdded > 0)
                    _journal.Debug($"TP Target: Added {htfCandidatesAdded} HTF liquidity targets (Daily/H4 PDH/PDL)");

                // Weekly accumulation range boundary
                if (_config.WeeklyAccumUseRangeTargets && TryGetMonTueRange(out var rHi, out var rLo, out var _, out var __))
                    candidates.Add(isBull ? rHi : rLo);

                // Compact range boundary for Ping-Pong mode
                if (_config.EnablePingPongMode && TryGetCompactRange(Chart?.TimeFrame ?? TimeFrame.Minute15, 120, _config.PingPongMaxRangePips, out var ppHi, out var ppLo))
                    candidates.Add(isBull ? ppHi : ppLo);

                // Internal-liquidity focus: latest internal swing inside the session/day
                if (_config.EnableInternalLiquidityFocus && TryGetLatestInternalSwing(isBull, out var internalPrice))
                    candidates.Add(internalPrice);

                // CHANGE #3: Lower timeframe liquidity zones (AFTER HTF priorities)
                // Skip HTF zones (already added above with higher priority)
                int ltfCandidatesAdded = 0;
                foreach (var z in zones)
                {
                    bool isHTFLevel = z.Label != null && (z.Label.Contains("PDH") || z.Label.Contains("PDL") ||
                                                           z.Label.Contains("Daily") || z.Label.Contains("H4"));
                    if (!isHTFLevel)  // Only add LTF zones here
                    {
                        if (isBull && z.Type == LiquidityZoneType.Supply)
                        {
                            candidates.Add(z.High);
                            ltfCandidatesAdded++;
                        }
                        if (!isBull && z.Type == LiquidityZoneType.Demand)
                        {
                            candidates.Add(z.Low);
                            ltfCandidatesAdded++;
                        }
                    }
                }
                if (_config.EnableDebugLogging && ltfCandidatesAdded > 0)
                    _journal.Debug($"TP Target: Added {ltfCandidatesAdded} LTF liquidity targets (EQH/EQL/etc)");

                // Choose nearest that satisfies min RR in the trade direction
                if (isBull)
                {
                    double best = double.MaxValue; bool found = false;
                    foreach (var tgt in candidates)
                    {
                        if (tgt <= entryPrice) continue;
                        double rrPips = (tgt - entryPrice) / pip;
                        if (rrPips >= requiredPips && tgt < best) { best = tgt; found = true; }
                    }
                    if (_config.EnableDebugLogging)
                    {
                        if (found)
                            _journal.Debug($"TP Target: Found BULLISH target={best:F5} | Required RR pips={requiredPips:F1} | Actual={((best - entryPrice) / pip):F1}");
                        else
                            _journal.Debug($"TP Target: NO BULLISH target meets MinRR | Candidates={candidates.Count} | Required={requiredPips:F1}pips");
                    }
                    return found ? (double?)best : null;
                }
                else
                {
                    double best = double.MinValue; bool found = false;
                    foreach (var tgt in candidates)
                    {
                        if (tgt >= entryPrice) continue;
                        double rrPips = (entryPrice - tgt) / pip;
                        if (rrPips >= requiredPips && tgt > best) { best = tgt; found = true; }
                    }
                    if (_config.EnableDebugLogging)
                    {
                        if (found)
                            _journal.Debug($"TP Target: Found BEARISH target={best:F5} | Required RR pips={requiredPips:F1} | Actual={((entryPrice - best) / pip):F1}");
                        else
                            _journal.Debug($"TP Target: NO BEARISH target meets MinRR | Candidates={candidates.Count} | Required={requiredPips:F1}pips");
                    }
                    return found ? (double?)best : null;
                }
            }
            catch { return null; }
        }

        private bool TryGetFractalSwingAnchor(bool isBull, out DateTime tAnchor, out double anchorLow, out double anchorHigh)
        {
            tAnchor = default; anchorLow = 0; anchorHigh = 0;
            try
            {
                var htf = MarketData.GetBars(_config.HtfObTimeFrame);
                if (htf == null || htf.Count < 10) return false;
                // find last swing in HTF in direction
                var highs = htf.HighPrices.Select(x => (double)x).ToList();
                var lows  = htf.LowPrices.Select(x => (double)x).ToList();
                int pivot = 3;
                int idx = -1;
                for (int k = htf.Count - 2; k >= pivot; k--)
                {
                    if (isBull && CCTTB.MSS.Core.Detectors.SwingDetector.IsSwingLow(lows, k, pivot, true)) { idx = k; break; }
                    if (!isBull && CCTTB.MSS.Core.Detectors.SwingDetector.IsSwingHigh(highs, k, pivot, true)) { idx = k; break; }
                }
                if (idx < 0) return false;
                tAnchor = htf.OpenTimes[idx];
                anchorLow = htf.LowPrices[idx];
                anchorHigh = htf.HighPrices[idx];

                // refine with nested TF if exists within that HTF bar range
                var ntf = MarketData.GetBars(_config.NestedObTimeFrame);
                if (ntf != null && ntf.Count > 10)
                {
                    DateTime t0 = tAnchor;
                    DateTime t1 = (idx + 1 < htf.Count) ? htf.OpenTimes[idx + 1] : t0.AddMinutes(60); // coarse fallback
                    int i0 = -1, i1 = -1;
                    for (int i = 0; i < ntf.Count; i++) { if (ntf.OpenTimes[i] >= t0) { i0 = i; break; } }
                    for (int i = ntf.Count - 1; i >= 0; i--) { if (ntf.OpenTimes[i] < t1) { i1 = i; break; } }
                    if (i0 >= 0 && i1 > i0)
                    {
                        var nh = ntf.HighPrices.Select(x => (double)x).ToList();
                        var nl = ntf.LowPrices.Select(x => (double)x).ToList();
                        // scan nested window for a clearer swing at same direction
                        int nidx = -1;
                        for (int k = i1; k >= Math.Max(i0, i1 - 100); k--)
                        {
                            if (isBull && CCTTB.MSS.Core.Detectors.SwingDetector.IsSwingLow(nl, k, 2, true)) { nidx = k; break; }
                            if (!isBull && CCTTB.MSS.Core.Detectors.SwingDetector.IsSwingHigh(nh, k, 2, true)) { nidx = k; break; }
                        }
                        if (nidx >= 0)
                        {
                            tAnchor = ntf.OpenTimes[nidx];
                            anchorLow = ntf.LowPrices[nidx];
                            anchorHigh = ntf.HighPrices[nidx];
                        }
                    }
                }
                return true;
            }
            catch { return false; }
        }

        private bool IsWithinKillZone(TimeSpan now, TimeSpan start, TimeSpan end)
        {
            if (start <= end) return now >= start && now <= end;
            return now >= start || now <= end; // overnight window
        }

        // Removed broker-specific margin override parsing to keep bot broker-agnostic

        private int FindBarIndexByTime(DateTime t)
        {
            // Multi-TF fix: MSS may be from M1 but we're checking M5 bars
            // Need fuzzy match - find the M5 bar that CONTAINS the M1 timestamp
            for (int k = Bars.Count - 1; k >= 0; k--)
            {
                DateTime barOpen = Bars.OpenTimes[k];

                // Exact match (original logic for same-TF signals)
                if (barOpen == t) return k;

                // Fuzzy match: Check if time t falls within this bar's period
                // M5 bar spans [barOpen, barOpen+5min), so t must be >= barOpen and < nextBarOpen
                if (k < Bars.Count - 1)
                {
                    DateTime nextBarOpen = Bars.OpenTimes[k + 1];
                    if (t >= barOpen && t < nextBarOpen) return k;
                }
                else
                {
                    // Last bar - check if t is >= barOpen (could be within the forming bar)
                    if (t >= barOpen) return k;
                }
            }
            return -1;
        }

        // Derive extra OTE zones from: sweep -> opposite MSS
        private List<OTEZone> DeriveOteFromSweepMss(Bars bars, List<LiquiditySweep> sweeps, List<MSSSignal> mssSignals)
        {
            var zones = new List<OTEZone>();
            if (bars == null || bars.Count < 10 || sweeps == null || sweeps.Count == 0 || mssSignals == null || mssSignals.Count == 0)
                return zones;

            // pick the most recent sweep
            var sweep = sweeps[sweeps.Count - 1];
            int sweepIdx = FindBarIndexByTime(sweep.Time);
            if (sweepIdx < 0) return zones;

            // find the first MSS after sweep in the opposite sense
            MSSSignal mss = null;
            for (int i = 0; i < mssSignals.Count; i++)
            {
                var s = mssSignals[i];
                if (!s.IsValid) continue;
                if (s.Time <= sweep.Time) continue;
                // If sweep was bullish (sell-side swept), require bullish MSS; if bearish sweep, require bearish MSS
                if (sweep.IsBullish && s.Direction == BiasDirection.Bullish) { mss = s; break; }
                if (!sweep.IsBullish && s.Direction == BiasDirection.Bearish) { mss = s; break; }
            }
            if (mss == null) return zones;

            int mssIdx = FindBarIndexByTime(mss.Time);
            if (mssIdx < 0 || mssIdx <= sweepIdx) return zones;

            // Determine swing anchors between sweep and MSS
            double swingLow = double.MaxValue;
            double swingHigh = double.MinValue;
            int from = Math.Max(0, sweepIdx - 2);
            int to = mssIdx;
            for (int k = from; k <= to; k++)
            {
                swingLow = Math.Min(swingLow, bars.LowPrices[k]);
                swingHigh = Math.Max(swingHigh, bars.HighPrices[k]);
            }

            bool isBull = mss.Direction == BiasDirection.Bullish;
            double a = isBull ? swingLow : swingHigh;
            // allow extension after MSS to last continuation candle within configured bars,
            // but stop early if a micro structure break happens against the MSS leg
            int ext = Math.Max(0, _config?.SweepMssExtensionBars ?? 0);
            int endIdx = Math.Min(bars.Count - 1, mssIdx + ext);
            double b = isBull ? bars.HighPrices[mssIdx] : bars.LowPrices[mssIdx];
            for (int k = mssIdx + 1; k <= endIdx; k++)
            {
                // micro break test: for bullish, a close below previous low ends extension;
                // for bearish, a close above previous high ends extension
                if (isBull)
                {
                    if (bars.ClosePrices[k] < bars.LowPrices[k - 1]) break;
                    b = Math.Max(b, bars.HighPrices[k]);
                }
                else
                {
                    if (bars.ClosePrices[k] > bars.HighPrices[k - 1]) break;
                    b = Math.Min(b, bars.LowPrices[k]);
                }
            }
            var (l618, l79) = Fibonacci.CalculateOTE(a, b, isBull);

            zones.Add(new OTEZone
            {
                Time = bars.OpenTimes[mssIdx],
                Direction = mss.Direction,
                OTE618 = l618,
                OTE79 = l79,
                ImpulseStart = a,
                ImpulseEnd = b
            });

            return zones;
        }

        // Compute breaker blocks from HTF OB invalidations (verified on HTF)
        private List<BreakerBlock> ComputeHtfBreakers(Bars htfBars)
        {
            var res = new List<BreakerBlock>();
            if (htfBars == null || htfBars.Count < 10) return res;

            // Detect HTF OBs first
            var htfObs = _obDetector.DetectOrderBlocks(htfBars, new List<MSSSignal>(), new List<LiquiditySweep>()) ?? new List<OrderBlock>();

            int last = htfBars.Count - 1;
            for (int iOb = 0; iOb < htfObs.Count; iOb++)
            {
                var ob = htfObs[iOb];
                // find index by matching time
                int obIndex = -1;
                for (int k = 0; k < htfBars.Count; k++) { if (htfBars.OpenTimes[k] == ob.Time) { obIndex = k; break; } }
                if (obIndex < 0) continue;

                // invalidation: close beyond OB extreme
                bool invalidated = false;
                for (int i = obIndex + 1; i <= last; i++)
                {
                    if (ob.Direction == BiasDirection.Bullish && htfBars.ClosePrices[i] < ob.LowPrice) { invalidated = true; break; }
                    if (ob.Direction == BiasDirection.Bearish && htfBars.ClosePrices[i] > ob.HighPrice) { invalidated = true; break; }
                }
                if (!invalidated) continue;

                res.Add(new BreakerBlock
                {
                    Direction = (ob.Direction == BiasDirection.Bullish) ? BiasDirection.Bearish : BiasDirection.Bullish,
                    LowPrice = Math.Min(ob.LowPrice, ob.HighPrice),
                    HighPrice = Math.Max(ob.LowPrice, ob.HighPrice),
                    Time = ob.Time,
                    Index = obIndex
                });
            }
            return res;
        }

        private double GetSessionOffsetHours(DateTime serverNow)
        {
            try
            {
                if (_config == null) return 0.0;

                // Prefer preset (dropdown) for user-friendly selection
                string presetTzId = null;
                switch (_config.SessionTimeZonePreset)
                {
                    case SessionTimeZonePreset.ServerUTC:
                        return 0.0;
                    case SessionTimeZonePreset.NewYork:
                        presetTzId = "Eastern Standard Time"; // handles EST/EDT automatically
                        break;
                    case SessionTimeZonePreset.London:
                        presetTzId = "GMT Standard Time";     // handles GMT/BST automatically
                        break;
                    case SessionTimeZonePreset.Tokyo:
                        presetTzId = "Tokyo Standard Time";   // JST, no DST
                        break;
                    case SessionTimeZonePreset.Custom:
                        // fall through to custom handling below
                        break;
                }

                DateTime utc = serverNow.Kind == DateTimeKind.Utc
                    ? serverNow
                    : DateTime.SpecifyKind(serverNow, DateTimeKind.Utc);

                if (!string.IsNullOrWhiteSpace(presetTzId))
                {
                    var tzPreset = TimeZoneInfo.FindSystemTimeZoneById(presetTzId);
                    return tzPreset.GetUtcOffset(utc).TotalHours;
                }

                // Custom: either use DST auto with provided TimeZoneId, or manual offset hours
                if (_config.SessionDstAutoAdjust)
                {
                    string tzid = string.IsNullOrWhiteSpace(_config.SessionTimeZoneId)
                        ? "Eastern Standard Time"
                        : _config.SessionTimeZoneId.Trim();
                    var tz = TimeZoneInfo.FindSystemTimeZoneById(tzid);
                    return tz.GetUtcOffset(utc).TotalHours;
                }

                return _config.SessionTimeOffsetHours;
            }
            catch { return _config?.SessionTimeOffsetHours ?? 0.0; }
        }

        // ═══════════════════════════════════════════════════════════════════════════════
        // ADVANCED RISK MANAGEMENT
        // ═══════════════════════════════════════════════════════════════════════════════

        /// <summary>
        /// Check all risk management gates BEFORE allowing entry signal generation.
        /// Returns true if trading is allowed, false if blocked by risk management.
        /// </summary>
        private bool CheckRiskManagementGates()
        {
            // Reset daily counters at start of new day
            DateTime today = Server.Time.Date;
            if (_state.DailyResetDate != today)
            {
                _state.DailyResetDate = today;
                _state.DailyStartingBalance = Account.Balance;
                _state.DailyTradeCount = 0;
            }

            // 1. CIRCUIT BREAKER: Daily Loss Limit
            if (EnableCircuitBreakerParam)
            {
                double dailyPnL = Account.Balance - _state.DailyStartingBalance;
                double dailyPnLPercent = (_state.DailyStartingBalance > 0) ? (dailyPnL / _state.DailyStartingBalance) * 100.0 : 0;

                if (dailyPnLPercent <= -DailyLossLimitPercentParam)
                {
                    if (Server.Time < _state.TradingDisabledUntil)
                    {
                        // Already disabled, no need to log again
                    }
                    else
                    {
                        _state.TradingDisabledUntil = Server.Time.Date.AddDays(1); // Disable until tomorrow
                        Print($"⚠️ CIRCUIT BREAKER ACTIVATED: Daily loss {dailyPnLPercent:F2}% >= limit {DailyLossLimitPercentParam:F2}%. Trading disabled until {_state.TradingDisabledUntil:yyyy-MM-dd HH:mm}");
                        if (_config?.EnableDebugLogging == true) _journal?.Debug($"Circuit breaker: Daily loss {dailyPnLPercent:F2}% >= {DailyLossLimitPercentParam:F2}%");
                    }
                    return false; // Block trading
                }

                // Reset trading disabled flag if it's a new day
                if (Server.Time >= _state.TradingDisabledUntil)
                {
                    _state.TradingDisabledUntil = DateTime.MinValue;
                }

                // Check if currently disabled
                if (Server.Time < _state.TradingDisabledUntil)
                {
                    return false; // Still disabled
                }
            }

            // 1B. CIRCUIT BREAKER: Consecutive Losses Protection
            if (EnableCircuitBreaker && _circuitBreakerActive)
            {
                // Check if pause period has expired
                if (Server.Time >= _pauseTradingUntil)
                {
                    _circuitBreakerActive = false;
                    Print($"✅ CIRCUIT BREAKER RELEASED - Resuming trading after {CircuitBreakerPauseMinutes} minutes pause");
                    if (_config?.EnableDebugLogging == true) _journal?.Debug($"Circuit breaker released. Consecutive losses reset.");
                }
                else
                {
                    // Still in pause period
                    if (_config?.EnableDebugLogging == true && Bars.Count % 50 == 0)
                    {
                        TimeSpan remaining = _pauseTradingUntil - Server.Time;
                        _journal?.Debug($"Circuit breaker active. Resume in {remaining.TotalMinutes:F0} minutes. Consecutive losses: {_consecutiveLosses}");
                    }
                    return false; // Block trading
                }
            }

            // 2. MAX DAILY TRADES
            if (_state.DailyTradeCount >= MaxDailyTradesParam)
            {
                if (_config?.EnableDebugLogging == true && Bars.Count % 50 == 0)
                {
                    _journal?.Debug($"Daily trade limit reached: {_state.DailyTradeCount}/{MaxDailyTradesParam}");
                }
                return false; // Block trading
            }

            // 3. MAX CONCURRENT POSITIONS (already exists in _config.MaxConcurrentPositions)
            if (Positions.Count >= _config.MaxConcurrentPositions)
            {
                if (_config?.EnableDebugLogging == true && Bars.Count % 50 == 0)
                {
                    _journal?.Debug($"Max positions reached: {Positions.Count}/{_config.MaxConcurrentPositions}");
                }
                return false; // Block trading
            }

            // 4. TRADE CLUSTERING PREVENTION: Cooldown after consecutive losses
            if (EnableClusteringPreventionParam && Server.Time < _state.CooldownUntil)
            {
                if (_config?.EnableDebugLogging == true && Bars.Count % 50 == 0)
                {
                    _journal?.Debug($"Cooldown active until {_state.CooldownUntil:HH:mm}. Consecutive losses: {_state.ConsecutiveLosses}");
                }
                return false; // Block trading during cooldown
            }

            // All gates passed
            return true;
        }

        /// <summary>
        /// Track position entry for time-in-trade management.
        /// Call this AFTER position is opened.
        /// </summary>
        private void OnPositionOpened(Position position, string detectorLabel)
        {
            if (position == null) return;

            // Track entry time for time-in-trade management
            string posKey = $"{position.SymbolName}_{position.Id}";
            _state.PositionEntryTimes[posKey] = Server.Time;

            // Increment daily trade counter
            _state.DailyTradeCount++;

            // Track detector for performance analysis
            if (!string.IsNullOrEmpty(detectorLabel))
            {
                if (!_state.DetectorTotal.ContainsKey(detectorLabel))
                {
                    _state.DetectorTotal[detectorLabel] = 0;
                    _state.DetectorWins[detectorLabel] = 0;
                    _state.DetectorLosses[detectorLabel] = 0;
                }
                _state.DetectorTotal[detectorLabel]++;
            }

            if (_config?.EnableDebugLogging == true)
            {
                _journal?.Debug($"Position opened: {posKey} | Detector: {detectorLabel} | Daily trades: {_state.DailyTradeCount}/{MaxDailyTradesParam}");
            }
        }

        /// <summary>
        /// Event handler wrapper for Positions.Opened event.
        /// Extracts detector label from position and calls tracking method.
        /// </summary>
        private void OnPositionOpenedEvent(PositionOpenedEventArgs args)
        {
            if (args?.Position == null) return;

            string detectorLabel = ExtractDetectorLabel(args.Position.Label);
            OnPositionOpened(args.Position, detectorLabel);
        }

        /// <summary>
        /// Handle position close events for performance tracking and cooldown management.
        /// Call this in Positions.Closed event handler.
        /// </summary>
        private void OnPositionClosed(PositionClosedEventArgs args)
        {
            if (args?.Position == null) return;

            var position = args.Position;
            string posKey = $"{position.SymbolName}_{position.Id}";

            // PHASED STRATEGY: Update PhaseManager with position outcome
            if (_phaseManager != null)
            {
                bool hitTP = position.NetProfit > 0; // Simplified: profit = TP, loss = SL
                double pnl = position.NetProfit;
                var currentPhase = _phaseManager.GetCurrentPhase();

                // Determine which phase exit method to call based on current phase
                if (currentPhase == TradingPhase.Phase1_Active)
                {
                    _phaseManager.OnPhase1Exit(hitTP, pnl);
                    if (_config?.EnableDebugLogging == true)
                        _journal?.Debug($"[PHASE 1] Position closed with {(hitTP ? "TP" : "SL")} | PnL: ${pnl:F2}");
                }
                else if (currentPhase == TradingPhase.Phase3_Active)
                {
                    _phaseManager.OnPhase3Exit(hitTP, pnl);
                    if (_config?.EnableDebugLogging == true)
                        _journal?.Debug($"[PHASE 3] Position closed with {(hitTP ? "TP" : "SL")} | PnL: ${pnl:F2}");
                }
            }

            // Track win/loss for clustering prevention
            if (position.NetProfit < 0)
            {
                _state.ConsecutiveLosses++;
                _consecutiveLosses++; // Track for circuit breaker

                // Activate cooldown if threshold reached
                if (EnableClusteringPreventionParam && _state.ConsecutiveLosses >= CooldownAfterLossesParam)
                {
                    _state.CooldownUntil = Server.Time.AddHours(CooldownDurationHoursParam);
                    Print($"⏸️ Trading cooldown activated after {_state.ConsecutiveLosses} consecutive losses. Resume at {_state.CooldownUntil:HH:mm}");
                    if (_config?.EnableDebugLogging == true)
                    {
                        _journal?.Debug($"Cooldown activated: {_state.ConsecutiveLosses} losses >= {CooldownAfterLossesParam}. Duration: {CooldownDurationHoursParam}h");
                    }
                }

                // CIRCUIT BREAKER: Trigger on consecutive losses
                if (EnableCircuitBreaker && _consecutiveLosses >= MaxConsecutiveLosses && !_circuitBreakerActive)
                {
                    _circuitBreakerActive = true;
                    _pauseTradingUntil = Server.Time.AddMinutes(CircuitBreakerPauseMinutes);

                    Print("═══════════════════════════════════════════════");
                    Print("   🛑 CIRCUIT BREAKER ACTIVATED");
                    Print($"   Reason: {MaxConsecutiveLosses} consecutive losses");
                    Print($"   Paused until: {_pauseTradingUntil:yyyy-MM-dd HH:mm}");
                    Print($"   Duration: {CircuitBreakerPauseMinutes} minutes");
                    Print("═══════════════════════════════════════════════");

                    if (_config?.EnableDebugLogging == true)
                    {
                        _journal?.Debug($"Circuit breaker activated: {_consecutiveLosses} losses >= {MaxConsecutiveLosses}. Pause until {_pauseTradingUntil:yyyy-MM-dd HH:mm}");
                    }

                    // Close all open positions for safety
                    var openPositions = Positions.ToList();
                    foreach (var pos in openPositions)
                    {
                        ClosePosition(pos);
                    }
                    if (openPositions.Count > 0)
                    {
                        Print($"✓ Closed {openPositions.Count} open positions (circuit breaker protection)");
                    }
                }
            }
            else if (position.NetProfit > 0)
            {
                _state.ConsecutiveLosses = 0; // Reset on win
                _consecutiveLosses = 0; // Reset circuit breaker counter on win
            }

            // Track detector performance
            // Extract detector label from position label/comment if available
            string detectorLabel = ExtractDetectorLabel(position.Label);
            if (!string.IsNullOrEmpty(detectorLabel))
            {
                if (position.NetProfit > 0)
                {
                    if (!_state.DetectorWins.ContainsKey(detectorLabel)) _state.DetectorWins[detectorLabel] = 0;
                    _state.DetectorWins[detectorLabel]++;
                }
                else
                {
                    if (!_state.DetectorLosses.ContainsKey(detectorLabel)) _state.DetectorLosses[detectorLabel] = 0;
                    _state.DetectorLosses[detectorLabel]++;
                }
            }

            // Remove from tracking
            _state.PositionEntryTimes.Remove(posKey);

            if (_config?.EnableDebugLogging == true)
            {
                double pnlPercent = (position.Quantity > 0) ? (position.NetProfit / (position.Quantity * position.EntryPrice)) * 100.0 : 0;
                _journal?.Debug($"Position closed: {posKey} | PnL: {position.NetProfit:F2} ({pnlPercent:F2}%) | Detector: {detectorLabel} | Consecutive losses: {_state.ConsecutiveLosses}");
            }

            // ADVANCED FEATURE: SELF-DIAGNOSIS - Record trade outcome by component
            if (_selfDiagnosis != null && !string.IsNullOrEmpty(detectorLabel))
            {
                try
                {
                    bool isWin = position.NetProfit > 0;
                    double profitLoss = position.NetProfit;
                    double confidence = _tradeManager?.GetPositionConfidence(position.Id) ?? 0.5;

                    _selfDiagnosis.RecordTradeOutcome(detectorLabel, isWin, profitLoss, confidence);
                    _state.TotalClosedTrades++;

                    if (_config?.EnableDebugLogging == true)
                        _journal?.Debug($"[SELF-DIAGNOSIS] Recorded {detectorLabel}: {(isWin ? "WIN" : "LOSS")} | PnL: {profitLoss:F2} | Confidence: {confidence:F2}");

                    // Generate diagnostic report every 50 trades
                    if (_state.TotalClosedTrades - _state.LastDiagnosticTradeCount >= 50)
                    {
                        string diagnosticReport = _selfDiagnosis.GetDiagnosticReport();
                        Print(diagnosticReport);

                        // Print parameter suggestions if available
                        var suggestions = _selfDiagnosis.GetParameterSuggestions();
                        if (suggestions.Count > 0)
                        {
                            Print("═══════════════════════════════════════════════════════");
                            Print("PARAMETER SUGGESTIONS:");
                            foreach (var kvp in suggestions)
                            {
                                Print($"  {kvp.Key}: {kvp.Value}");
                            }
                            Print("═══════════════════════════════════════════════════════");
                        }

                        _state.LastDiagnosticTradeCount = _state.TotalClosedTrades;
                    }
                }
                catch (Exception ex)
                {
                    Print($"[SELF-DIAGNOSIS] ERROR recording trade outcome: {ex.Message}");
                }
            }

            // OCT 27 SWING LEARNING: Update swing OTE outcome when trade completes
            if (_learningEngine != null && _config != null && _config.EnableAdaptiveLearning && _state.ActiveOTE != null)
            {
                try
                {
                    double swingHigh = Math.Max(_state.ActiveOTE.ImpulseStart, _state.ActiveOTE.ImpulseEnd);
                    double swingLow = Math.Min(_state.ActiveOTE.ImpulseStart, _state.ActiveOTE.ImpulseEnd);
                    string direction = (_state.ActiveOTE.Direction == BiasDirection.Bullish) ? "Bullish" : "Bearish";
                    bool oteWorked = (position.NetProfit > 0);  // Win = OTE worked, Loss = OTE failed
                    string outcome = oteWorked ? "Win" : "Loss";

                    _learningEngine.UpdateSwingOTEOutcome(direction, swingHigh, swingLow, oteWorked, outcome);

                    if (_config.EnableDebugLogging)
                        _journal?.Debug($"[SWING LEARNING] Updated swing outcome: {direction} | OTE Worked: {oteWorked} | Outcome: {outcome}");
                }
                catch (Exception ex)
                {
                    Print($"[SWING LEARNING] ERROR updating swing outcome: {ex.Message}");
                }
            }
        }

        /// <summary>
        /// Check and manage time-in-trade limits for open positions.
        /// ONLY closes PROFITABLE positions after time limit (let SL manage losing positions).
        /// Call this in OnBar or OnTick.
        /// </summary>
        private void ManageTimeInTrade()
        {
            if (MaxTimeInTradeHoursParam <= 0) return;

            var positionsToClose = new List<Position>();

            foreach (var position in Positions)
            {
                string posKey = $"{position.SymbolName}_{position.Id}";

                if (_state.PositionEntryTimes.TryGetValue(posKey, out DateTime entryTime))
                {
                    double hoursInTrade = (Server.Time - entryTime).TotalHours;

                    if (hoursInTrade >= MaxTimeInTradeHoursParam)
                    {
                        // CRITICAL FIX (Oct 22, 2025): Only close if position is PROFITABLE
                        // Let stop loss manage losing positions naturally
                        if (position.NetProfit > 0)
                        {
                            positionsToClose.Add(position);
                            Print($"⏱️ Closing PROFITABLE position due to time limit: {posKey} (held {hoursInTrade:F1}h, P&L: +${position.NetProfit:F2})");
                            if (_config?.EnableDebugLogging == true)
                            {
                                _journal?.Debug($"Time-in-trade exit (profitable): {posKey} held {hoursInTrade:F1}h >= {MaxTimeInTradeHoursParam:F1}h | P&L: +${position.NetProfit:F2}");
                            }
                        }
                        else
                        {
                            // Log that we're keeping the losing position to let SL manage it
                            if (_config?.EnableDebugLogging == true)
                            {
                                _journal?.Debug($"Time-in-trade: KEEPING losing position {posKey} (held {hoursInTrade:F1}h, P&L: ${position.NetProfit:F2}) → Let SL manage risk");
                            }
                        }
                    }
                }
            }

            // Close positions outside the loop to avoid collection modification
            foreach (var position in positionsToClose)
            {
                try
                {
                    ClosePosition(position);
                }
                catch (Exception ex)
                {
                    Print($"Error closing position {position.Id}: {ex.Message}");
                }
            }
        }

        /// <summary>
        /// Extract detector label from position label.
        /// Position label format: "Jadecap-Pro-OTE" or "Jadecap-Pro-OB", etc.
        /// </summary>
        private string ExtractDetectorLabel(string positionLabel)
        {
            if (string.IsNullOrEmpty(positionLabel)) return "";

            // Try to extract detector name from label
            if (positionLabel.Contains("OTE")) return "OTE";
            if (positionLabel.Contains("OB")) return "OB";
            if (positionLabel.Contains("FVG")) return "FVG";
            if (positionLabel.Contains("Breaker")) return "Breaker";

            return "Unknown";
        }

        /// <summary>
        /// Draw performance HUD on chart showing today's stats.
        /// Call this in OnBar or OnTick after checking positions.
        /// </summary>
        private void DrawPerformanceHUD()
        {
            if (!_config.EnableDebugLogging) return; // Only show when debug is on

            try
            {
                // Calculate today's PnL
                double todayPnL = Account.Balance - _state.DailyStartingBalance;
                double todayPnLPercent = (_state.DailyStartingBalance > 0) ? (todayPnL / _state.DailyStartingBalance) * 100.0 : 0;

                // Count wins/losses today
                int todayWins = 0;
                int todayLosses = 0;
                foreach (var kvp in _state.DetectorWins)
                {
                    todayWins += kvp.Value;
                }
                foreach (var kvp in _state.DetectorLosses)
                {
                    todayLosses += kvp.Value;
                }

                // Find best detector
                string bestDetector = "";
                double bestWinRate = 0;
                foreach (var detector in _state.DetectorTotal.Keys)
                {
                    int total = _state.DetectorTotal[detector];
                    if (total > 0)
                    {
                        int wins = _state.DetectorWins.ContainsKey(detector) ? _state.DetectorWins[detector] : 0;
                        double winRate = (wins / (double)total) * 100.0;
                        if (winRate > bestWinRate)
                        {
                            bestWinRate = winRate;
                            bestDetector = detector;
                        }
                    }
                }

                // Format HUD text with proper spacing (using newlines for vertical separation)
                string hudText = $"📊 PERFORMANCE HUD\n";
                hudText += $"Today: {todayWins}W/{todayLosses}L | PnL: {todayPnLPercent:+0.0;-0.0}% | Trades: {_state.DailyTradeCount}/{MaxDailyTradesParam}";

                if (!string.IsNullOrEmpty(bestDetector))
                {
                    hudText += $" | Best: {bestDetector} {bestWinRate:F0}%";
                }

                if (_state.ConsecutiveLosses > 0)
                {
                    hudText += $"\n⚠️ Consecutive Losses: {_state.ConsecutiveLosses}";
                }

                if (Server.Time < _state.CooldownUntil)
                {
                    hudText += $"\n⏸️ Cooldown: {(_state.CooldownUntil - Server.Time).TotalMinutes:F0}m remaining";
                }

                // Add bias status if available (consolidate with performance HUD)
                if (_biasStateMachine != null)
                {
                    var bias = _biasStateMachine.GetConfirmedBias() ?? _state.LastHTFBias ?? BiasDirection.Neutral;
                    var biasState = _biasStateMachine.GetState();
                    var biasConfidence = _biasStateMachine.GetConfidence();
                    hudText += $"\n\n🧭 BIAS: {bias} | State: {biasState} | Confidence: {biasConfidence}";
                }

                // Draw consolidated HUD (top-left of chart)
                Chart.DrawStaticText("PerformanceHUD", hudText, VerticalAlignment.Top, HorizontalAlignment.Left, Color.White);
            }
            catch (Exception ex)
            {
                if (_config?.EnableDebugLogging == true)
                {
                    _journal?.Debug($"Error drawing performance HUD: {ex.Message}");
                }
            }
        }

        // ══════════════════════════════════════════════════════════════════
        // Orchestrator Config Loader Methods
        // ══════════════════════════════════════════════════════════════════

        private void ReloadConfigSafe()
        {
            try
            {
                var effectivePath = GetEffectiveConfigPath();
                var cfg = ConfigLoader.LoadActiveConfig(effectivePath);
                // Safety clamps (match policy)
                cfg.scoring.weights.w_session = Math.Max(0.00, Math.Min(0.60, cfg.scoring.weights.w_session));
                cfg.risk.multiplier = Math.Max(0.40, Math.Min(1.25, cfg.risk.multiplier));
                _cfg = cfg;
                _lastCfgWrite = System.IO.File.GetLastWriteTime(effectivePath);

                if (_config?.EnableDebugLogging == true)
                {
                    var presetInfo = GetEffectivePresetName();
                    var modeInfo = presetInfo != null ? $"Manual mode, preset={presetInfo}" : "Auto-switching orchestrator";
                    _journal?.Debug($"[ORCHESTRATOR] Config loaded from {effectivePath} | Mode: {modeInfo} | w_session={cfg.scoring.weights.w_session:F2} risk={cfg.risk.multiplier:F2}");
                }
            }
            catch (Exception ex)
            {
                if (_config?.EnableDebugLogging == true)
                {
                    _journal?.Debug($"[ORCHESTRATOR] Config load failed: {ex.Message} (using defaults)");
                }
                _cfg = new ActiveConfig(); // fail-open to defaults
            }
        }

        /// <summary>
        /// Calculate effective risk percent by applying orchestrator risk multiplier
        /// </summary>
        private double EffectiveRiskPercent(double baseRiskPercent)
        {
            return baseRiskPercent * (_cfg?.risk.multiplier ?? 0.85);
        }

        /// <summary>
        /// Calculate signal score using orchestrator weights
        /// </summary>
        /// <param name="baseScore">Base signal score</param>
        /// <param name="sessionFactor">Session factor [-1, +1] (e.g., +1 for preferred session, -0.5 off-session)</param>
        /// <param name="volZ">Volatility Z-score (normalized)</param>
        /// <param name="spreadZ">Spread Z-score (normalized)</param>
        /// <param name="newsRisk">News risk factor [0, 1]</param>
        /// <returns>Weighted score</returns>
        private double Score(double baseScore, double sessionFactor, double volZ, double spreadZ, double newsRisk)
        {
            var w = _cfg?.scoring?.weights ?? new ActiveConfig.Scoring.Weights();
            return baseScore
                 + w.w_session * sessionFactor
                 + w.w_vol * volZ
                 - w.w_spread * spreadZ
                 - w.w_news * newsRisk;
        }

        /// <summary>
        /// Apply phase-based logic and risk to a trade signal before execution.
        /// Determines which phase we're in and modifies risk accordingly.
        /// Returns null if phase conditions not met, otherwise returns modified signal.
        /// </summary>
        private TradeSignal ApplyPhaseLogic(TradeSignal signal, string poiType)
        {
            // ═══════════════════════════════════════════════════════════════
            // OCT 30 ENHANCEMENT #3: QUALITY FILTERING (BEFORE PHASE LOGIC)
            // ═══════════════════════════════════════════════════════════════
            // Filter low-quality signals FIRST (before any risk allocation)
            if (!FilterLowQualitySignals(signal))
            {
                if (_config.EnableDebugLogging)
                    _journal.Debug($"[APPLY_PHASE] Signal rejected by quality filter | POI: {poiType}");
                return null; // Blocked by quality filter
            }

            // ═══════════════════════════════════════════════════════════════
            // OCT 30 ENHANCEMENT #2: ENTRY CONFIRMATION (TIMING/PRICE CHECK)
            // ═══════════════════════════════════════════════════════════════
            // Validate entry timing and price position
            double currentPrice = signal.Direction == BiasDirection.Bullish ? Symbol.Ask : Symbol.Bid;
            if (!ValidateEntryConfirmation(signal, currentPrice))
            {
                if (_config.EnableDebugLogging)
                    _journal.Debug($"[APPLY_PHASE] Signal rejected by entry confirmation | POI: {poiType}");
                return null; // Blocked by entry confirmation
            }

            if (signal == null || _phaseManager == null)
            {
                // Even without phase manager, calculate unified confidence and filter
                if (_config.UseUnifiedConfidence)
                {
                    double confidence = CalculateUnifiedConfidenceScore(signal.Direction);
                    signal.ConfidenceScore = confidence;

                    // Filter by minimum confidence threshold
                    if (confidence < _config.MinConfidenceScore)
                    {
                        if (_config.EnableDebugLogging)
                            _journal.Debug($"[UNIFIED CONFIDENCE FILTER] ❌ Signal REJECTED | Confidence: {confidence:F2} < Min: {_config.MinConfidenceScore:F2}");
                        return null; // Block low-confidence trade
                    }

                    // Apply dynamic risk scaling
                    if (_config.UseConfidenceRiskScaling)
                    {
                        double riskMultiplier = CalculateConfidenceRiskMultiplier(confidence);
                        double originalRisk = _config.RiskPercent;
                        _config.RiskPercent = originalRisk * riskMultiplier;

                        if (_config.EnableDebugLogging)
                            _journal.Debug($"[RISK SCALING] Confidence: {confidence:F2} | Multiplier: {riskMultiplier:F2}× | Risk: {originalRisk:F2}% → {_config.RiskPercent:F2}%");
                    }

                    if (_config.EnableDebugLogging)
                        _journal.Debug($"[UNIFIED CONFIDENCE FILTER] ✅ Signal ACCEPTED | Confidence: {confidence:F2}");
                }

                // Also enrich with legacy confidence for comparison
                EnrichSignalWithConfidence(signal);
                return signal;
            }

            var currentPhase = _phaseManager.GetCurrentPhase();
            bool isOTEEntry = (poiType == "OTE" || signal.OTEZone != null);

            // OCT 30: Calculate unified confidence BEFORE phase logic
            double unifiedConfidence = 0.0;
            if (_config.UseUnifiedConfidence)
            {
                unifiedConfidence = CalculateUnifiedConfidenceScore(signal.Direction);
                signal.ConfidenceScore = unifiedConfidence;

                // Filter by minimum confidence threshold
                if (unifiedConfidence < _config.MinConfidenceScore)
                {
                    if (_config.EnableDebugLogging)
                        _journal.Debug($"[UNIFIED CONFIDENCE FILTER] ❌ Signal REJECTED | Confidence: {unifiedConfidence:F2} < Min: {_config.MinConfidenceScore:F2}");
                    return null; // Block low-confidence trade
                }
            }

            // Determine if this is Phase 1 (counter-trend toward OTE) or Phase 3 (with-trend from OTE)
            bool isPhase1Candidate = !isOTEEntry; // Phase 1 = entries BEFORE OTE (OB, FVG, Breaker)
            bool isPhase3Candidate = isOTEEntry;   // Phase 3 = entries FROM OTE

            if (isPhase1Candidate)
            {
                // PHASE 1: Counter-trend toward OTE (0.2% risk)
                if (!_phaseManager.CanEnterPhase1())
                {
                    if (_config.EnableDebugLogging)
                        _journal.Debug($"[PHASE 1] Entry blocked - Phase: {currentPhase} | POI: {poiType}");
                    return null; // Block entry
                }

                // Modify risk to 0.2% for Phase 1
                double originalRisk = _config.RiskPercent;
                double phase1Risk = _phasedPolicy.Phase1RiskPercent();
                _config.RiskPercent = phase1Risk; // Apply Phase 1 risk

                // OCT 30: Apply confidence-based risk scaling if enabled
                if (_config.UseUnifiedConfidence && _config.UseConfidenceRiskScaling && unifiedConfidence > 0)
                {
                    double confidenceMultiplier = CalculateConfidenceRiskMultiplier(unifiedConfidence);
                    _config.RiskPercent = phase1Risk * confidenceMultiplier;

                    if (_config.EnableDebugLogging)
                        _journal.Debug($"[PHASE 1 + CONFIDENCE] Risk scaled: {phase1Risk}% × {confidenceMultiplier}× = {_config.RiskPercent:F2}% | Confidence: {unifiedConfidence:F2}");
                }

                // DON'T call OnPhase1Entry() here - signal might still be rejected later
                // OnPhase1Entry() will be called after trade execution (in OnPositionOpened)
                // _phaseManager.OnPhase1Entry(); // MOVED to OnPositionOpened

                if (_config.EnableDebugLogging)
                    _journal.Debug($"[PHASE 1] ✅ Entry allowed | POI: {poiType} | Risk: {_config.RiskPercent}% (was {originalRisk}%)");

                // Enrich with unified confidence before returning
                EnrichSignalWithConfidence(signal);
                return signal; // Allow entry with Phase 1 risk
            }
            else if (isPhase3Candidate)
            {
                // PHASE 3: With-trend from OTE (0.3-0.9% risk based on Phase 1 outcome)
                if (!_phaseManager.CanEnterPhase3(out double riskMultiplier, out bool requireExtraConfirmation))
                {
                    if (_config.EnableDebugLogging)
                        _journal.Debug($"[PHASE 3] Entry blocked - Phase: {currentPhase} | OTE touch: {_oteTouchDetector?.GetTouchLevel()}");
                    return null; // Block entry
                }

                // Check extra confirmation if required (after 1× Phase 1 failure)
                if (requireExtraConfirmation)
                {
                    // Require both FVG and OB to be present (extra confirmation)
                    bool hasFVG = (signal.ToString().Contains("FVG")); // Simplified check
                    bool hasOB = (signal.OrderBlock != null);

                    if (!hasFVG || !hasOB)
                    {
                        if (_config.EnableDebugLogging)
                            _journal.Debug($"[PHASE 3] Entry blocked - Extra confirmation required (FVG+OB) after Phase 1 failure | Has FVG: {hasFVG}, Has OB: {hasOB}");
                        return null; // Require both FVG and OB
                    }
                }

                // Calculate Phase 3 risk with multiplier and apply to config
                double originalRisk = _config.RiskPercent;
                double basePhase3Risk = _phasedPolicy.Phase3RiskPercent();
                double finalRisk = basePhase3Risk * riskMultiplier;
                _config.RiskPercent = finalRisk; // Apply Phase 3 risk

                // OCT 30: Apply confidence-based risk scaling if enabled
                if (_config.UseUnifiedConfidence && _config.UseConfidenceRiskScaling && unifiedConfidence > 0)
                {
                    double confidenceMultiplier = CalculateConfidenceRiskMultiplier(unifiedConfidence);
                    _config.RiskPercent = finalRisk * confidenceMultiplier;

                    if (_config.EnableDebugLogging)
                        _journal.Debug($"[PHASE 3 + CONFIDENCE] Risk scaled: {finalRisk}% × {confidenceMultiplier}× = {_config.RiskPercent:F2}% | Confidence: {unifiedConfidence:F2}");
                }

                // DON'T call OnPhase3Entry() here - signal might still be rejected later
                // OnPhase3Entry() will be called after trade execution (in OnPositionOpened)
                // _phaseManager.OnPhase3Entry(); // MOVED to OnPositionOpened

                if (_config.EnableDebugLogging)
                {
                    string condition = (riskMultiplier == 1.5) ? "No Phase 1 or Success" :
                                      (riskMultiplier == 0.5) ? "After 1× Phase 1 Failure" : "Default";
                    _journal.Debug($"[PHASE 3] ✅ Entry allowed | Condition: {condition} | Risk: {_config.RiskPercent}% (was {originalRisk}%, base {basePhase3Risk}% × {riskMultiplier})");
                }

                // Enrich with unified confidence before returning
                EnrichSignalWithConfidence(signal);
                return signal; // Allow entry with Phase 3 risk
            }

            // Neither Phase 1 nor Phase 3 candidate (shouldn't happen)
            // Enrich with unified confidence before returning
            EnrichSignalWithConfidence(signal);
            return signal;
        }

        // ═══════════════════════════════════════════════════════════════════
        // CONFIDENCE-BASED RISK MULTIPLIER (OCT 30)
        // ═══════════════════════════════════════════════════════════════════
        private double CalculateConfidenceRiskMultiplier(double confidence)
        {
            // High confidence = higher risk, Low confidence = lower risk
            // As requested: 0.85+ = 1.5x, 0.70-0.85 = 1.0x, 0.60-0.70 = 0.5x

            if (confidence >= 0.85)
                return 1.5; // Excellent confidence → 150% risk (0.6% becomes 0.9%)
            else if (confidence >= 0.70)
                return 1.0; // Strong confidence → Normal risk (0.4% stays 0.4%)
            else if (confidence >= 0.60)
                return 0.5; // Good confidence → Reduced risk (0.4% becomes 0.2%)
            else
                return 0.3; // Below threshold (shouldn't happen due to MinConfidenceScore filter)
        }
    }
}


























