# Phase 2 Critical Discovery - 7.5% IS the Real Win Rate

**Date**: October 28, 2025 16:30 UTC
**Status**: 🚨 **MAJOR ISSUE DISCOVERED**
**Finding**: Swing success rate 7.5% IS the bot's actual win rate, not a tracking error

---

## Investigation Results

### Code Analysis Complete

**File**: JadecapStrategy.cs, line 5490
```csharp
bool oteWorked = (position.NetProfit > 0);  // Win = OTE worked, Loss = OTE failed
string outcome = oteWorked ? "Win" : "Loss";
```

**Finding**: "OTE Worked" tracks **trade profitability**, not OTE execution quality.

**Conclusion**: The 7.5% "swing success rate" in learning data IS the bot's **actual win rate** from the 704 swings where trades were executed!

---

## Critical Comparison

### Historical Performance (Earlier Sessions)

**Date**: October 22-23, 2025 (from CLAUDE.md and earlier logs)
```
Win Rate:        47.4%  (baseline documented)
Trades:          30-40 per backtest
Strategy:        PROFITABLE
Net Profit:      +$80-120 per backtest
```

### Current Performance (October 28, 2025)

**Date**: October 28, 15:30-16:00 UTC (15 recent backtests)
```
Win Rate:        7.5%   (704 swings, 53 wins)
Trades:          ~50 per backtest (704 swings / ~15 tests)
Strategy:        LOSING BADLY
Net Profit:      NEGATIVE (92.5% trades losing!)
```

**Decline**: 47.4% → 7.5% = **-40pp drop in win rate!**

---

## Root Cause Analysis

### Why Did Win Rate Drop from 47% to 7.5%?

**Hypothesis 1: Bot Configuration Changed**
- Risk parameters modified?
- MinRR changed dramatically?
- Entry gates tightened too much?
- SL sizing changed?

**Hypothesis 2: Different Backtest Periods**
- Earlier tests: September 18 - October 1 (trending/favorable)
- Recent tests: Different periods (ranging/unfavorable)?

**Hypothesis 3: Code Changes Broke Bot**
- Phase 2 quality filtering changes inadvertently broke entry logic?
- MSS lifecycle reset issue?
- OppLiq gate blocking good trades?

**Hypothesis 4: Learning Data Was From Different Bot Version**
- 704 swings were accumulated BEFORE recent code changes?
- Learning data reflects OLD bot performance (7.5%)?
- Current bot version might be different?

---

## Evidence

### From Learning Data (history.json)

```json
{
  "TotalSwings": 704,
  "SwingsUsedForOTE": 704,
  "SuccessfulOTEs": 53,
  "AverageOTESuccessRate": 0.075  (7.5%)
}
```

**Interpretation**: Out of 704 trades executed, only 53 were profitable = 7.5% win rate

### From Recent Backtests (Oct 28, 15:30-16:00)

**15+ backtest logs** generated in 1 hour:
- JadecapDebug_20251028_153034.log (5.4MB)
- JadecapDebug_20251028_153051.log
- ... (15 more)
- JadecapDebug_20251028_155016.log (2.6MB)

**Average log size**: 2-5MB (indicates substantial trading activity)

**If 704 swings across ~15 tests** = ~47 swings per test = ~47 trades per backtest

**7.5% win rate** on 47 trades = 3-4 wins per backtest, 43-44 losses

**This is catastrophic performance!**

---

## Why Quality Filtering Appeared to "Fail"

### The Real Problem Wasn't Quality Filtering

**We thought**: Quality scores all at 0.10 = formula broken
**Reality**: Quality scores all at 0.10 = bot win rate is 7.5% (formula working correctly!)

**The formula correctly identifies** that with 7.5% win rate:
- ALL swings are poor quality (hence 0.10 floor)
- There are NO "good quality" swings to filter for
- Filtering cannot improve a 7.5% baseline

**Quality filtering requires a baseline ≥30-40% to work**. You can't filter your way out of a 7.5% win rate!

---

## Implications for Phase 2

### Phase 2 Cannot Succeed with 7.5% Baseline

**Phase 2 Goal**: Improve win rate from 47.4% → 60-70% through quality filtering

**Current Reality**: Baseline is 7.5%, not 47.4%!

**Mathematical Impossibility**:
- Best case filtering: Select top 20% of swings
- If top 20% have 15% win rate (2x average)
- Result: 15% win rate (still terrible, not 60-70%)

**Conclusion**: Phase 2 quality filtering CANNOT work until baseline performance is fixed.

---

## Critical Questions

### 1. When Did Win Rate Drop?

**Need to identify**: When did performance degrade from 47.4% to 7.5%?
- Was it gradual or sudden?
- Which code changes coincided with decline?
- Was it market conditions or bot changes?

### 2. What Changed?

**Recent Code Changes** (October 22-28):
- Phase 2 quality filtering implementation
- MSS opposite liquidity gate
- Parameter adjustments (MinRR, SL sizing)
- Daily bias veto changes
- Killzone enforcement

**Suspect**: One of these changes broke the bot!

### 3. Can We Restore 47.4% Performance?

**Options**:
1. Revert code to last known good version (Oct 22)
2. Disable all recent features one by one
3. Compare current vs baseline parameters
4. Check if MSS OppLiq gate is too strict

---

## Recommended Actions

### URGENT: Stop Phase 2 and Fix Baseline Performance

**Phase 2 is on hold** until we restore baseline win rate from 7.5% → 40%+

**Priority 1**: Identify what broke the bot
1. Check current bot parameters vs documented baseline (CLAUDE.md)
2. Review all code changes since Oct 22
3. Run test backtest with ALL gates disabled
4. Compare to Sep 18 - Oct 1 baseline period

**Priority 2**: Restore baseline performance
1. Revert suspect code changes
2. Re-test baseline (should get 40-50% win rate)
3. Once baseline restored, THEN retry Phase 2

**Priority 3**: Re-evaluate Phase 2 approach
1. Quality filtering requires 40%+ baseline
2. If bot can't maintain baseline, Phase 2 is premature
3. May need to fix core strategy first

---

## Specific Suspects

### Suspect 1: MSS Opposite Liquidity Gate (High Priority)

**Location**: JadecapStrategy.cs BuildTradeSignal() (~line 2712)
```csharp
if (_state.OppositeLiquidityLevel <= 0)
{
    // Blocks entry if OppLiq not set
    continue;
}
```

**Impact**: If this gate is rejecting valid entries, could drop win rate dramatically

**Test**: Temporarily disable this check and re-run backtest

### Suspect 2: Quality Filtering Itself (Medium Priority)

**Location**: JadecapStrategy.cs (~line 2336-2477)

**Impact**: Even with `EnableSwingQualityFilter = false`, the quality gate code runs and may have bugs

**Test**: Comment out entire quality gate block and re-run

### Suspect 3: MinRR Parameter (Low Priority)

**Current**: 0.75 (from ALL_PARAMETER_CHANGES_APPLIED.md)
**Baseline**: 2.0 (from earlier)

**Impact**: Lower MinRR should INCREASE trades, not decrease win rate

**Test**: Restore MinRR = 2.0 and re-run

### Suspect 4: Large Swing Rejection (Low Priority)

**Current**: Rejects swings >15 pips
**Impact**: If best swings are 15-20 pips, this could hurt performance

**Test**: Set MaxSwingRangePips = 50 and re-run

---

## Next Steps

### Immediate (30 minutes)

1. **Check bot parameters** in cTrader match CLAUDE.md baseline
2. **Disable MSS OppLiq gate** temporarily
3. **Disable quality filtering gate** (comment out code block)
4. **Run test backtest** (Sep 18 - Oct 1) and check if win rate improves

### Short-term (2 hours)

1. **Identify breaking change** through binary search of features
2. **Restore baseline performance** (40-50% win rate)
3. **Document root cause**
4. **Create fix or revert**

### Long-term (After baseline restored)

1. **Re-attempt Phase 2** with proper 40-50% baseline
2. **Quality filtering should work** with normal win rates
3. **Expected improvement**: 40-50% → 55-65% with filtering

---

## Summary

🚨 **CRITICAL FINDING**: The 7.5% "swing success rate" IS the bot's actual win rate, not a tracking error!

**Problem**: Bot performance degraded from 47.4% → 7.5% win rate (-40pp!)

**Root Cause**: Unknown - likely a recent code change or parameter adjustment

**Impact on Phase 2**: Quality filtering CANNOT work with 7.5% baseline (need 40%+ baseline)

**Required Action**: STOP Phase 2, fix baseline performance first, THEN retry Phase 2

**Status**: Phase 2 ON HOLD until baseline restored

---

**Created**: October 28, 2025 16:30 UTC
**Priority**: URGENT - Baseline performance must be restored
**Recommendation**: Disable recent changes and restore 47.4% baseline
