using System;

namespace CCTTB
{
    // Central policy enums to avoid duplicated/ambiguous flags.
    public enum EntryGateMode
    {
        Any = 0,           // Legacy behavior
        MSSOnly = 1,       // Require any MSS variant
        MSS_and_OTE = 2,   // Require MSS + OTE
        Triple = 3,        // Require MSS + Breaker + IFVG
        Scoring = 4        // Use scoring threshold
    }

    public enum OtePolicy
    {
        None = 0,
        IfAvailable = 1,
        Always = 2,
        StrictAfterMSS = 3,
        ContinuationReanchor = 4
    }

    public enum SweepScope
    {
        Any = 0,
        PDH_PDL_Only = 1,
        Internal_Only = 2,
        Weekly_Only = 3
    }

    public enum TpTargetPolicy
    {
        OppositeLiquidity = 0,
        WeeklyHighLow = 1,
        InternalBoundary = 2,
        Manual = 3
    }


    public enum PresetOption
    {
        None = 0,
        NY_Strict_InternalOnly,
        PostNews_Continuation,
        Asia_Liquidity_Sweep,
        NY_Strict_TripleSequence,
        PostNews_TripleStrict,
        Asia_Internal_Mechanical,
        Asia_Internal_StrictMechanical,
        London_Internal_Mechanical,
        London_Internal_StrictMechanical,
        London_Triple_Strict,
        Weekly_Focused,
        London_Weekly_Focused,
        NY_Weekly_Focused,
        Asia_Weekly_Focused,
        NY_Strict,
        NY_Strict_Triple,
        Phase4o4_NY_Strict,
        Phase4o4_Pingpong_Range,
        Phase4o4_PO3_Strict,
        Phase4o4_SMT_Filter,
        Phase4o4_Strict_Preset,
        Phase4o4_Triple_Confirm,
        Phase4o4_Video_Strict,
        PostNews_Triple_Strict,
        Asia_Internal_Mechanical_Alt
    }

    public enum PolicyMode
    {
        AutoSwitching_Orchestrator = 0,      // policy_universal.json - Auto-switches by market state
        Manual_Intelligent_Universal = 1,     // policy.json + Intelligent_Universal preset
        Manual_Perfect_Sequence_Hunter = 2,   // policy.json + Perfect_Sequence_Hunter preset
        Manual_Learning_Adaptive = 3,         // policy.json + Learning_Adaptive preset
        Manual_Phase4o4_Strict_Enhanced = 4,  // policy.json + phase4o4_strict_ENHANCED preset
        Custom_Path = 99                      // Use custom ConfigPath string
    }

}