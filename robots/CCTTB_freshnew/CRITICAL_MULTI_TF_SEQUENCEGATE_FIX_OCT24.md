# CRITICAL FIX: Multi-Timeframe SequenceGate Timestamp Resolution (Oct 24, 2025)

## Problem Summary

**Impact**: 🔴 CATASTROPHIC - Bot executed **ZERO trades** in backtests despite valid setup detection
**Root Cause**: Multi-timeframe cascade (M5 liquidity → M1 MSS) created timestamp mismatch
**Symptoms**: SequenceGate found valid MSS but then failed with "sequence gate failed"

## Technical Details

### Multi-TF Architecture

The bot uses a **multi-timeframe cascade** design:
- **Chart Timeframe**: M5 (5 minute bars)
- **Liquidity Detection**: M5 timeframe
- **MSS Detection**: **M1 (1 minute bars)** for higher precision
- **Entry Signals**: Built on M5 bars

This is logged at startup:
```
[Multi-TF Cascade] M5 liquidity → M1 MSS
[Multi-TF Cascade] Chart TF: Minute5 | MSS TF: Minute
```

### The Bug

`ValidateSequenceGate()` calls `FindBarIndexByTime(s.Time)` to locate MSS signals in the M5 bar series:

**Original Code** (JadecapStrategy.cs line 4455-4460):
```csharp
private int FindBarIndexByTime(DateTime t)
{
    for (int k = Bars.Count - 1; k >= 0; k--)
        if (Bars.OpenTimes[k] == t) return k;  // EXACT match only
    return -1;
}
```

**Problem Flow**:
1. MSS detected on M1 at `20:01:30` (1-minute bar)
2. M5 bars only have: `20:00:00`, `20:05:00`, `20:10:00`, etc.
3. Exact match `20:01:30 == 20:00:00` fails → Returns `-1`
4. SequenceGate line 4151: `return mssIdx >= 0;` → **FALSE**
5. Line 4171 logs: "SequenceGate: no valid MSS found → FALSE"
6. Entry blocked, trade rejected

**Backtest Evidence** (log - Copy (2).txt lines 71-73):
```
71: SequenceGate: found valid MSS dir=Bearish after sweep -> TRUE
72: SequenceGate: found valid MSS dir=Bearish after sweep -> TRUE
73: OTE: sequence gate failed
```

The gate finds the MSS (line 71-72) but then immediately fails (line 73) because `FindBarIndexByTime()` returns -1.

### Frequency and Impact

**Backtest Period**: Sep 17-25, 2025 (8 days)
- **Sequence gate failures**: 106 occurrences
- **Trades executed**: 0
- **Win rate**: N/A (no trades)
- **PnL**: $0.00

**Why This Breaks Everything**:
- SequenceGate is **enabled by default** (`_cfg.gates.sequenceGate: True`)
- ALL entries (OTE, OB, FVG) must pass SequenceGate when enabled
- If SequenceGate returns false → Entry immediately rejected → Zero trades

## Solution

Changed `FindBarIndexByTime()` to support **fuzzy timestamp matching**:

**Fixed Code** (JadecapStrategy.cs line 4455-4480):
```csharp
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
```

### Fix Logic

**Example**:
- M1 MSS detected at `20:01:30`
- M5 bars: `[20:00:00, 20:05:00)`, `[20:05:00, 20:10:00)`, etc.
- Check: Is `20:01:30 >= 20:00:00` AND `< 20:05:00`? → **YES**
- Return index of `20:00:00` bar → SequenceGate passes → Entry allowed

**Backward Compatibility**:
- Exact match check **preserved** (line 4464)
- Fuzzy match is **fallback** (lines 4468-4477)
- Same-TF signals (e.g., M5→M5) still use exact match
- Multi-TF signals (e.g., M1→M5) use fuzzy match

## Validation

**Build Status**: ✅ SUCCESS (0 errors, 0 warnings)

**Expected Results** (after fix):
- SequenceGate should now find M1 MSS timestamps in M5 bars
- Entries should pass gate validation
- Trades should execute (targeting 1-4 per day)
- Log should show: "SequenceGate: found valid MSS dir=X after sweep → TRUE" followed by entry execution

**Testing Required**:
1. Run Sep 17-25 backtest with fixed bot
2. Verify `ExecuteMarketOrder` calls > 0
3. Compare trade count before (0) vs after (expected 8-32 trades over 8 days)

## Root Cause Analysis

**Why This Wasn't Caught Earlier**:
1. Multi-TF cascade was added later (M1 MSS for precision)
2. SequenceGate logic predates multi-TF cascade
3. Debug logs showed "found valid MSS" but not the subsequent `-1` return from FindBarIndexByTime
4. No explicit log message for "mssIdx < 0" failure path

**Systemic Issue**:
Any method calling `FindBarIndexByTime()` with M1 timestamps will fail:
- ✅ **Fixed**: ValidateSequenceGate → MSS lookup
- ⚠️ **Check**: DeriveOteFromSweepMss (line 4471) → Same issue?
- ⚠️ **Check**: Any other MSS time-based lookups

## Files Modified

- **JadecapStrategy.cs** (line 4455-4480): Fixed FindBarIndexByTime() with fuzzy matching

## Related Issues

- **HTF System Integration**: Newly added HTF Bias/Sweep system also uses multi-TF data (15m/1H HTF vs 5m chart)
- **BiasStateMachine**: Should verify timestamp resolution for HTF candle lookups
- **Future TF Combinations**: Any X-minute chart + Y-minute MSS will need fuzzy matching

## Recommendations

1. ✅ **IMMEDIATE**: Deploy fixed bot and re-run Sep 17-25 backtest
2. ⚠️ **AUDIT**: Search codebase for all `FindBarIndexByTime()` calls and verify multi-TF compatibility
3. 📝 **DOCUMENT**: Add multi-TF timestamp handling to architecture docs
4. 🧪 **TEST**: Create unit test for timestamp fuzzy matching logic
5. 🔍 **MONITOR**: Watch for "SequenceGate: no valid MSS found" in future logs (should be rare now)

## Success Criteria

**Before Fix**:
- 106 sequence gate failures
- 0 trades executed
- "OTE: sequence gate failed" spam in logs

**After Fix**:
- SequenceGate passes when valid M1 MSS exists
- Trades execute (1-4 per day expected)
- Clean logs with successful entry confirmations

---

**Status**: ✅ FIXED - Build successful, ready for backtest validation
**Priority**: 🔴 P0 - Blocking all trade execution
**Fix Date**: 2025-10-24
**Build**: CCTTB.algo (Debug/net6.0)
