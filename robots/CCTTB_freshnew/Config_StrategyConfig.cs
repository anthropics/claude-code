using System;
using cAlgo.API;

namespace CCTTB
{
    public enum SessionTimeZonePreset
    {
        ServerUTC,
        NewYork,
        London,
        Tokyo,
        Custom
    }
    public enum MSSBreakTypeEnum
    {
        Both,
        WickOnly,
        BodyPercentOnly
    }

    public enum EntryConfirmationModeEnum
    {
        Single,
        Double,
        Triple
    }

    public enum EntryPresetEnum
    {
        None,
        ModelA_MSS_OTE,
        ModelB_MSS_IFVG,
        ModelC_Breaker_IFVG
    }

    // Backwards-compatible session preset enum used by legacy presets
    public enum SessionPresetEnum
    {
        ServerUTC,
        NewYork,
        London,
        Asia,
        Custom
    }

    // Backwards-compatible bias alignment enum used by legacy presets
    public enum BiasAlignModeEnum
    {
        Loose,
        Strict
    }

    public enum ProfilePresetEnum
    {
        None,
        IntradayBias,
        WeeklyAccumulation,
        PO3_Strict
    }

    public class StrategyConfig
    {
        // Public alias used by legacy code
        public double MinTakeProfitPips { get; set; } = 4.0;
        // Backwards-compatible RR default (1.0 means 1:1)
        public double DefaultTakeProfitRR { get; set; } = 1.0;

        // —— Unified policy switches (replace multiple overlapping flags) ——

        public EntryGateMode EntryGateMode { get; set; } = EntryGateMode.Any;
        public OtePolicy OtePolicy { get; set; } = OtePolicy.IfAvailable;
        public SweepScope SweepScope { get; set; } = SweepScope.Any;
        public TpTargetPolicy TpTargetPolicy { get; set; } = TpTargetPolicy.OppositeLiquidity;

        public bool SessionUseServerUTC { get; set; } = true;

        public bool StrictSequence { get; set; } = true; // Enforce Sweep→MSS→(Breaker∧IFVG)→OTE

        // NOTE: Legacy flags below are kept for backwards-compatibility,
        // but are IGNORED when the unified policy above is not EntryGateMode.Any or OtePolicy != IfAvailable.
        // UI: These should be hidden in settings panels.

        // -- Core timing / bias --
        public TimeFrame BiasTimeFrame { get; set; }
        public int BiasConfirmationBars { get; set; } = 2;
        public TimeSpan KillZoneStart { get; set; }
        public TimeSpan KillZoneEnd { get; set; }
        // Apply this offset (hours) to Server.Time to obtain session-local time
        // Example: server UTC, NY session in EST/EDT => set to -5 (EST) or -4 (EDT)
        public double SessionTimeOffsetHours { get; set; } = 0.0;
        // If true, override SessionTimeOffsetHours using Windows TimeZone rules for the given SessionTimeZoneId
        public bool SessionDstAutoAdjust { get; set; } = false;
        // Windows time zone id to use for DST auto adjust (e.g., "Eastern Standard Time")
        public string SessionTimeZoneId { get; set; } = "Eastern Standard Time";
        public SessionTimeZonePreset SessionTimeZonePreset { get; set; } = SessionTimeZonePreset.NewYork;
        public bool EnableIntradayBias { get; set; } = false; // Day-open sweep + TF shift filter
        public TimeFrame IntradayBiasTimeFrame { get; set; } = TimeFrame.Minute15;
        public bool RequireSwingDiscountPremium { get; set; } = true; // enforce POIs on correct half of last MSS swing

        // POI validity and sweep focus
        public bool RequirePOIKeyLevelInteraction { get; set; } = false; // POI must touch/overlap a key level (PDH/PDL/CDH/CDL/EQH/EQL/PWH/PWL)
        public double KeyLevelInteractionPips { get; set; } = 1.0;
        public bool KeyValidUsePDH_PDL { get; set; } = true;
        public bool KeyValidUseCDH_CDL { get; set; } = true;
        public bool KeyValidUseEQH_EQL { get; set; } = true;
        public bool KeyValidUsePWH_PWL { get; set; } = true;
        public bool RequireInternalSweep { get; set; } = false; // accept only internal (non-PD/weekly/CD) sweeps

        // —— MSS thresholds ——
        public MSSBreakTypeEnum MSSBreakType { get; set; }
        public double BodyPercentThreshold { get; set; }
        public double WickThreshold { get; set; }
        public double BothThreshold { get; set; }

        // -- Entry confirmation --
        public bool EnableMultiConfirmation { get; set; }
        public EntryConfirmationModeEnum ConfirmationMode { get; set; }
        public EntryPresetEnum EntryPreset { get; set; } = EntryPresetEnum.None;
        public ProfilePresetEnum ProfilePreset { get; set; } = ProfilePresetEnum.None;

        // —— Execution / risk ——
        public bool EnableScalingEntries { get; set; }
        public bool EnableDynamicStopLoss { get; set; }
        public bool EnablePOIBoxDraw { get; set; }
        public double RiskPercent { get; set; } = 0.3;  // OCT 30 OPTIMIZED: Was 0.4% → Now 0.3% (safer, allows 10 trades before 3% daily limit)
        public double MinRiskReward { get; set; } = 1.5;  // OCT 30 OPTIMIZED: Was 2.0 → Now 1.5 (quality over quantity, realistic for M5)
        public string PoiPriorityOrder { get; set; } = "OTE>FVG>OB>Breaker";
        public bool RequireOteIfAvailable { get; set; } = true;
        public bool RequireOteAlways { get; set; } = false;
        // Strict flow: enter only on OTE derived at MSS swing completion (after opposite micro-break), in MSS direction
        public bool StrictOteAfterMssCompletion { get; set; } = true;
        // Sequence gate: Sweep -> opposite MSS -> OTE/OB
        public bool EnableSequenceGate { get; set; } = true;
        public int  SequenceLookbackBars { get; set; } = 50;
        public Color SequenceObColor { get; set; } = Color.DeepSkyBlue;
        public double StopExtraPipsSeq { get; set; } = 1.0;
        public bool UseOppositeLiquidityTP { get; set; } = true;
        public double TpOffsetPips { get; set; } = 1.0;
        // Scaling / capacity
        public int MaxConcurrentPositions { get; set; } = 2;
        // Entry fallback when strict sequence gate fails (OCT 26 CASCADE FIX: DISABLED - No fallbacks allowed)
        public bool AllowSequenceGateFallback { get; set; } = false;
        // Dual tap gating (OTE + POI)
        public bool RequireDualTap { get; set; } = false;
        public DualTapPairEnum DualTapPair { get; set; } = DualTapPairEnum.OTE_OB;
        public double DualTapOverlapPips { get; set; } = 1.0;
        // Micro confirmation: require breaking last candle in entry direction
        public bool RequireMicroBreak { get; set; } = false;
        // Require adverse pullback after break before accepting a tap
        public bool RequirePullbackAfterBreak { get; set; } = false;
        public double PullbackMinPips { get; set; } = 0.5;
        // When price extends after MSS and only later prints an opposite micro-break,
        // re-anchor OTE to the true extreme reached before that break
        public bool EnableContinuationReanchorOTE { get; set; } = true;
        // Temporary verbose debug logging to file (data/logs)
        public bool EnableDebugLogging { get; set; } = true;
        // Break reference selection
        public BreakRefMode BreakReference { get; set; } = BreakRefMode.PrevCandle;
        public int BreakLookbackBars { get; set; } = 20;
        // Risk guardrails
        public double   MinSlPipsFloor { get; set; } = 5.0;
        public bool     EnforceAtrSanity { get; set; } = true;
        public int      AtrPeriod { get; set; } = 14;
        public double   AtrSanityFactor { get; set; } = 0.25; // SL must be >= factor * ATR
        public bool     EnforceNotionalCap { get; set; } = false;
        public double   NotionalCapMultiple { get; set; } = 2.0;
        public bool     EnableTpSpreadCushion { get; set; } = true;
        public double   SpreadCushionExtraPips { get; set; } = 0.2;
        public bool     SpreadCushionUseAvg    { get; set; } = false;
        public int      SpreadAvgPeriod        { get; set; } = 10;
        public bool     EnableMarginCheck      { get; set; } = true;
        public double   MarginUtilizationMax   { get; set; } = 0.5; // use up to 50% of free margin for new trade
        public double   DefaultLeverageAssumption { get; set; } = 30.0;
        // Execution pacing
        public int      CooldownBarsAfterEntry { get; set; } = 3;
        // OCT 26 CASCADE FIX: MSS quality gates
        public bool     RequireMssBodyClose { get; set; } = true;      // Require body-close beyond BOS (not just wick)
        public double   MssMinDisplacementPips { get; set; } = 2.0;   // Minimum displacement in pips
        public double   MssMinDisplacementATR { get; set; } = 0.2;    // OR minimum as fraction of ATR(14)
        // OCT 26 CASCADE FIX: OTE tap precision
        public double   OteTapBufferPips { get; set; } = 0.5;          // Tap tolerance (±0.5 pips from 61.8-78.6% zone)
        // OCT 26 CASCADE FIX: Re-entry discipline
        public int      ReentryCooldownBars { get; set; } = 1;          // Bars to wait before retap same OTE zone
        public double   ReentryRRImprovement { get; set; } = 0.2;      // RR must improve by this much for re-entry

        // —— OCT 27 ADAPTIVE LEARNING SYSTEM ——
        public bool     EnableAdaptiveLearning { get; set; } = true;    // Enable daily pattern learning
        public string   AdaptiveLearningDataPath { get; set; } = "C:\\Users\\Administrator\\Documents\\cAlgo\\Data\\cBots\\CCTTB\\data\\learning";
        public bool     UseAdaptiveScoring { get; set; } = true;        // Use historical scores for pattern quality
        public bool     UseAdaptiveParameters { get; set; } = false;    // Auto-adjust MinRR/OTE/MSS based on learning (CONSERVATIVE - disabled by default)
        public double   AdaptiveLearningRate { get; set; } = 0.2;       // How quickly to adapt (0.1=slow, 0.3=fast)
        public int      AdaptiveMinTradesRequired { get; set; } = 50;   // Minimum trades before adaptive adjustments kick in
        public double   AdaptiveConfidenceThreshold { get; set; } = 0.6; // Minimum confidence to use pattern (0.5=neutral)

        // —— OCT 28 PHASE 2: SWING QUALITY FILTERING ——
        // OCT 28 RE-ENABLED: Data collection complete (1340 swings, 9% avg success, 26.5% London, 30% 15-20pip swings)
        public bool     EnableSwingQualityFilter { get; set; } = true;   // RE-ENABLED after data collection
        public double   MinSwingQuality { get; set; } = 0.30;            // Threshold 0.30 targets London+Bearish+15-20pip (20-35% expected WR)
        public double   MinSwingQualityLondon { get; set; } = 0.28;      // Slightly lower for London (best session: 26.5% success)
        public double   MinSwingQualityAsia { get; set; } = 0.30;        // Standard threshold (Asia: 11.6% success)
        public double   MinSwingQualityNY { get; set; } = 0.32;          // Stricter for NY (worst session: 7.6% success)
        public double   MinSwingQualityOther { get; set; } = 0.32;       // Stricter for Other (worst: 4.9% success)
        public bool     RejectLargeSwings { get; set; } = true;          // Keep large swing rejection (>15 pips: 0.4% success)
        public double   MaxSwingRangePips { get; set; } = 15.0;          // Maximum swing size in pips before rejection
        // DATA COLLECTION COMPLETE: 1340 swings collected. Quality variance: 0.303-0.386. Best: London(26.5%), Bearish(21.3%), 15-20pip(30%)
        // EXPECTED PERFORMANCE: 15-30% acceptance, 20-35% win rate (vs 9% baseline = 2-4x improvement!)

        // —— OCT 29 PRICE ACTION QUALITY FILTERING ——
        public bool     EnablePriceActionFiltering { get; set; } = false;  // Filter Corrective MSS breaks (34.5% rejection rate)
        // When enabled: Blocks all Corrective MSS (weak structure breaks with high overlap)
        // Expected impact: -34.5% entries, +10-15% win rate, improved average RR
        // See: PRICE_ACTION_ANALYSIS_REPORT.md for detailed analysis

        // —— OCT 30 UNIFIED CONFIDENCE SCORING (3 Human-Like Enhancements) ——
        public bool     UseUnifiedConfidence { get; set; } = true;          // OCT 30 ENABLED: Multi-factor confidence scoring
        public double   MinConfidenceScore { get; set; } = 0.75;            // OCT 30 OPTIMIZED: Was 0.70 → Now 0.75 (stricter filter)
        public bool     UseConfidenceRiskScaling { get; set; } = true;      // OCT 30 ENABLED: Scale risk by confidence
        // Combines: Bias alignment + Price Action quality + POI confluence + News context
        // Score > 0.8 = EXCELLENT (1.5x risk), 0.7-0.8 = STRONG (1.25x), 0.6-0.7 = GOOD (1.0x)
        // Expected: -40% entries (only high-confluence setups), +15-25% win rate improvement

        // —— OCT 30 STRUCTURAL STOP LOSS ——
        public bool     UseStructuralStopLoss { get; set; } = true;         // OCT 30 ENABLED: Use swing invalidation SL (more robust than fixed)
        public double   StructuralSLBufferPips { get; set; } = 3.0;         // Buffer beyond swing level (3 pips default)
        public double   MaxStructuralSLPips { get; set; } = 40.0;           // OCT 30 OPTIMIZED: Was 50 → Now 40 (tighter cap for M5)
        // Places SL at actual swing high/low that invalidates the setup (human-like logic)
        // More robust than fixed 20-pip SL, adapts to market volatility

        // —— OCT 30 ENHANCED DYNAMIC TP ——
        public bool     UseHTFLiquidityTargets { get; set; } = false;       // Prioritize Daily/H4 liquidity for TP
        public bool     UseRegimeBasedRR { get; set; } = false;             // Adjust RR requirements by market regime
        public double   TrendingMinRR { get; set; } = 2.0;                  // Min RR when trending (aim for HTF levels)
        public double   RangingMinRR { get; set; } = 1.0;                   // Min RR when ranging (range extremes)
        public bool     UseFibExtensionsForTP { get; set; } = false;        // Use 1.618/2.0 extensions in strong trends
        // HTF liquidity = Daily/H4 PDH/PDL, FVG, OB levels (most reliable targets)
        // Regime detection: Trending vs Ranging determines realistic RR expectations

        // —— OCT 30 ENHANCEMENT #2 & #3: ENTRY CONFIRMATION & QUALITY FILTERING ——
        public bool     RequireEntryConfirmation { get; set; } = true;      // Enable entry timing/price validation
        public int      MinBarsAfterOTE { get; set; } = 2;                  // Wait N bars after OTE tap (avoid immediate entries)
        public bool     BlockCorrectiveMSS { get; set; } = true;            // Block entries on corrective MSS breaks
        public bool     BlockWeakMTFBias { get; set; } = true;              // Block entries when MTF bias is weak
        public int      MinMTFBiasScore { get; set; } = 3;                  // Minimum MTF bias score (out of 10)

        // —— Colors ——
        public Color BullishColor { get; set; }
        public Color BearishColor { get; set; }
        public Color PDHColor { get; set; } = Color.Goldenrod;
        public Color PDLColor { get; set; } = Color.SteelBlue;
        public Color Eq50Color { get; set; } = Color.Gray;

        // —— Optional feature toggles ——
        public bool UseTimeframeAlignment { get; set; }
        public bool SessionBehaviorEnable { get; set; }
        public bool RequireOppositeSweep { get; set; }
        public int OppositeSweepLookback { get; set; }
        public int MssMaxAgeBars { get; set; }

        // —— Scoring mode ——
        public bool UseScoring { get; set; }
        public int ScoreMinTotal { get; set; }
        public int Score_MSS { get; set; }
        public int Score_MSS_Retest { get; set; }
        public int Score_OTE { get; set; }
        public int Score_OB { get; set; }
        public int Score_Sweep { get; set; }
        public int Score_Default { get; set; }

        // —— Session overrides (London/NY) ——
        public TimeSpan LondonStart { get; set; }
        public TimeSpan LondonEnd { get; set; }
        public TimeSpan NYStart { get; set; }
        public TimeSpan NYEnd { get; set; }
        public int MssDebounceBars_London { get; set; }
        public int MssDebounceBars_NY { get; set; }
        public bool RequireRetestToFOI_London { get; set; }
        public bool RequireRetestToFOI_NY { get; set; }

        // —— MSS base toggles ——
        public bool RequireMSSForEntry { get; set; }
        // When enabled, an entry is only allowed if BOTH an MSS signal and an OTE zone are present
        public bool RequireMSSandOTE { get; set; } = false;
        public bool CountMSSOnce { get; set; }
        public int MssDebounceBars { get; set; }
        public bool RequireRetestToFOI { get; set; }
        public bool EnableKillzoneGate { get; set; } = false;

        // Liquidity sources and sweep scope
        public bool IncludePrevDayLevelsAsZones { get; set; } = false; // Add PDH/PDL as liquidity zones
    public bool RequirePdhPdlSweepOnly { get; set; } = false;      // Sequence gate must use PDH/PDL sweeps
    // Legacy alias used elsewhere
    public bool RequirePDH_PDL_SweepOnly { get { return RequirePdhPdlSweepOnly; } set { RequirePdhPdlSweepOnly = value; } }

        // Equal High/Low liquidity pools and current-day range
        public bool IncludeEqualHighsLowsAsZones { get; set; } = false;
        public double EqTolerancePips { get; set; } = 1.0;
        public int EqLookbackBars { get; set; } = 50;
        public bool IncludeCurrentDayLevelsAsZones { get; set; } = false; // CDH/CDL

        // Weekly liquidity pools
        public bool IncludeWeeklyLevelsAsZones { get; set; } = false; // PWH/PWL

        // Sweep acceptance toggles (when not forcing PDH/PDL only)
        public bool AllowEqhEqlSweeps { get; set; } = true;
        public bool AllowCdhCdlSweeps { get; set; } = true;
        public bool AllowWeeklySweeps { get; set; } = true;

        // PO3 (Asia accumulation -> manipulation sweep -> distribution)
        public bool EnablePO3 { get; set; } = false;
        public TimeSpan AsiaStart { get; set; } = new TimeSpan(0, 0, 0);  // EST
        public TimeSpan AsiaEnd { get; set; }   = new TimeSpan(5, 0, 0);  // EST
        public bool RequireAsiaSweepBeforeEntry { get; set; } = false;
        public int PO3LookbackBars { get; set; } = 100;
        public double AsiaRangeMaxAdrPct { get; set; } = 60.0;
        public int AdrPeriod { get; set; } = 10;
        public bool SkipDoubleSweepInKillzone { get; set; } = true;

        // Triple confirmation (MSS + Breaker + IFVG)
        public bool RequireTripleConfirmation { get; set; } = false;
        public int Score_IFVG { get; set; } = 1;
        public int Score_Breaker { get; set; } = 1;

        // PingPong (range mode)
        public bool EnablePingPongMode { get; set; } = false;
        public bool PingPongUseEQZones { get; set; } = true;  // EQH/EQL
        public bool PingPongUseCDZones { get; set; } = true;  // CDH/CDL
        public double PingPongMaxRangePips { get; set; } = 30.0;
        public double PingPongMinBouncePips { get; set; } = 5.0;

        // SMT divergence confirmation
        public bool EnableSMT { get; set; } = false;
        public string SMT_CompareSymbol { get; set; } = "";
        public TimeFrame SMT_TimeFrame { get; set; } = TimeFrame.Hour;
        public bool SMT_AsFilter { get; set; } = false; // block entries that contradict SMT
        public int SMT_Pivot { get; set; } = 2;

        // News blackout windows (manual, daily local times HH:mm-HH:mm;HH:mm-HH:mm)
        public bool EnableNewsBlackout { get; set; } = false;
        public string NewsBlackoutWindows { get; set; } = "";
    // Legacy news fields used by presets
    public bool NewsAllowOnlyPost { get; set; } = false;
    public int NewsBlockWithinMinutes { get; set; } = 0;
    public int NewsPostDelayMinutes { get; set; } = 0;

        // Breaker / SL-TP / Re-entry / Weekly bias
        public bool RequireBreakerRetest { get; set; } = true;
        public bool BreakerEntryAtMid { get; set; } = true;
        public bool StopUseFOIEdge { get; set; } = true;
        public bool EnableReEntry { get; set; } = false;
        public int  ReEntryMax { get; set; } = 1;
        public int  ReEntryWithinBars { get; set; } = 30;
        public int  ReEntryCooldownBars { get; set; } = 3;
        public bool UseWeeklyProfileBias { get; set; } = false;

        // Weekly swing mode (weekly liquidity focus)
        public bool EnableWeeklySwingMode { get; set; } = false;
        public bool RequireWeeklySweep { get; set; } = false; // require PWH/PWL sweep before entries
        public bool UseWeeklyLiquidityTP { get; set; } = false; // prefer PWH/PWL as TP target
        public bool EnableInternalLiquidityFocus { get; set; } = false; // prefer internal boundaries for TP selection

        // Visual toggles
        public bool ShowMonTueOverlay { get; set; } = true;
        public bool ShowInternalSweepLabels { get; set; } = true;
        public bool ColorizeKeyLevelLabels { get; set; } = true;
        public bool ShowBOSArrows { get; set; } = true;
        public bool ShowImpulseZones { get; set; } = true;
        public bool ShowLiquiditySideLabels { get; set; } = true;
        public Color KeyColorPD { get; set; } = Color.Goldenrod;
        public Color KeyColorCD { get; set; } = Color.Gray;
        public Color KeyColorEQ { get; set; } = Color.SlateGray;
        public Color KeyColorWK { get; set; } = Color.MediumPurple;
        public string SummaryPosition { get; set; } = "TopCenter"; // TopLeft, TopCenter, TopRight, BottomLeft, BottomCenter, BottomRight
        public string LegendPosition { get; set; } = "TopRight";

        // Weekly accumulation (Mon/Tue range logic)
        public bool EnableWeeklyAccumulationBias { get; set; } = false;
        public TimeFrame WeeklyAccumShiftTimeFrame { get; set; } = TimeFrame.Minute5;
        public bool WeeklyAccumUseRangeTargets { get; set; } = true;

        // News trading windows (inverse of blackout): only allow entries during windows
        public bool EnableNewsModeOnly { get; set; } = false;
        public string NewsTradeWindows { get; set; } = ""; // HH:mm-HH:mm;HH:mm-HH:mm

        // Scalping profile overrides
        public bool EnableScalpingProfile { get; set; } = false;

        // —— POI / visual caps (used by DrawingTools) ——
        public int MaxSwingLines { get; set; } = 16;
        public int MaxLiquidityLines { get; set; } = 16;
        public int MaxMssLines { get; set; } = 6;
        public int MaxOTEBoxes { get; set; } = 4;
        public int MaxOBBoxes { get; set; } = 8;
        public int MaxPDObjects { get; set; } = 4;

        // —— Trade management (BE / partial / trailing) ——
        public bool EnableBreakEven { get; set; } = true;
        public double BreakEvenTriggerRR { get; set; } = 1.0;
        public double BreakEvenTriggerPips { get; set; } = 0.0;
        public double BreakEvenOffsetPips { get; set; } = 0.0;

        public bool EnablePartialClose { get; set; } = true;
        public double PartialCloseRR { get; set; } = 1.0;
        public double PartialClosePips { get; set; } = 0.0;
        public double PartialClosePercent { get; set; } = 50.0;

        public bool EnableTrailingStop { get; set; } = true;
        public double TrailStartRR { get; set; } = 1.0;
        public double TrailStartPips { get; set; } = 0.0;
        public double TrailDistancePips { get; set; } = 20.0;

        // ---- Visuals (FVG/FOI) ----
        public int MaxFVGBoxes { get; set; } = 6;
        public Color FVGColor { get; set; } = Color.Goldenrod;
        public int MaxBreakerBoxes { get; set; } = 8;
        public Color BreakerColor { get; set; } = Color.OrangeRed;
        public bool ShowBoxLabels { get; set; } = true;

        // ---- Risk & sizing guards ----
        public double MinStopPipsClamp { get; set; } = 20.0;                // Minimum SL distance (20 pips for M5)
        public double MaxStopPipsClamp { get; set; } = 40.0;                // OCT 30 NEW: Maximum SL distance (40 pips for M5)
        public double DailyLossLimitPercent { get; set; } = 3.0;            // OCT 30 NEW: Daily loss limit (3% circuit breaker)
        public long MaxVolumeUnits { get; set; } = 300_000;

        // ---- Fixed lot sizing (alternative to percentage-based risk) ----
        public bool UseFixedLotSize { get; set; } = false;
        public double FixedLotSize { get; set; } = 0.01; // Fixed lot size in standard lots (0.01 = 1 micro lot)

        // ---- Stop buffers by POI type ----
        public double StopBufferPipsOTE { get; set; } = 15.0;
        public double StopBufferPipsOB { get; set; } = 10.0;
        public double StopBufferPipsFVG { get; set; } = 10.0;

        // ═══════════════════════════════════════════════════════════════
        // PHASE 1B CHANGE #2: Session-Aware OTE Buffer
        // ═══════════════════════════════════════════════════════════════
        /// <summary>
        /// Get session-adjusted OTE buffer based on time of day (UTC)
        /// London/NY: Higher volatility → Use standard buffer (15 pips)
        /// Asia: Lower volatility → Reduce buffer to 10 pips (tighten entries)
        /// </summary>
        public double GetSessionAwareOTEBuffer(DateTime utcTime)
        {
            int hour = utcTime.Hour;

            // London session (07:00-16:00 UTC) - High volatility
            if (hour >= 7 && hour < 16)
                return 15.0;

            // New York session (13:00-22:00 UTC, overlaps London) - High volatility
            if (hour >= 13 && hour < 22)
                return 15.0;

            // Asia session (00:00-09:00 UTC) - Lower volatility, tighter buffer
            if (hour >= 0 && hour < 9)
                return 10.0;

            // Default (rest periods) - Use standard
            return 12.0;
        }

        // ---- Optional (if you want to tune touch tightness from code) ----
        public double TapTolerancePips { get; set; } = 1.0;

        // ═══════════════════════════════════════════════════════════════
        // DEAD ZONE FILTER (Oct 26, 2025)
        // ═══════════════════════════════════════════════════════════════
        /// <summary>
        /// Enable dead zone filter to avoid trading during low-liquidity periods
        /// 17:00-18:00 UTC = End of NY session / Pre-Asia = High chop, low win rate
        /// Session analysis: 22% win rate during this period vs 67% during killzones
        /// </summary>
        public bool EnableDeadZoneFilter { get; set; } = true;
        public int DeadZoneStartHour { get; set; } = 17;  // 17:00 UTC
        public int DeadZoneEndHour { get; set; } = 18;    // 18:00 UTC

        // ---- (If you use the dual-bias/entry-POI flow) ----
        // Legacy CT fields removed
        public bool     EnableFVGDraw            { get; set; } = false;
        public bool     EnableMssFibPack         { get; set; } = false;
        public bool     UseHtfOrderBlocks        { get; set; } = true;
        public TimeFrame HtfObTimeFrame          { get; set; } = TimeFrame.Hour;
        public TimeFrame NestedObTimeFrame       { get; set; } = TimeFrame.Minute15;
        public bool     EnableSweepMssOte        { get; set; } = true;
        public int      SweepMssExtensionBars    { get; set; } = 3;
        public Color    SweepMssOteColor         { get; set; } = Color.LightSkyBlue;
        
        // Safety for CT-flow
        public int CtMaxAgeBars { get; set; } = 12;     // drop stale CT signals
        public int CtDebounceBars { get; set; } = 3;

    }
}
