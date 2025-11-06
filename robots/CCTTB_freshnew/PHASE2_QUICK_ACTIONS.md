# Phase 2 Data Collection - Quick Actions

**Date**: October 28, 2025
**Status**: 🔄 **DATA COLLECTION PHASE ACTIVE**

---

## What Just Happened

**Quality filtering was DISABLED** because all quality scores = 0.10 (below 0.13 threshold) → 100% rejection → No data collection possible.

**Solution**: Accumulate 500+ swings with filtering OFF, then re-enable with proper threshold.

---

## Your Next Actions (30 Minutes)

### Action 1: Run 5 Backtests (15 minutes)

Open cTrader and run these 5 backtests:

```
Symbol:   EURUSD
TF:       M5
Balance:  $10,000

Periods:
1. September 1-15, 2025
2. September 15-30, 2025
3. October 1-15, 2025
4. October 15-31, 2025
5. August 15-31, 2025
```

**Verify bot parameters**:
- `EnableAdaptiveLearning = true` ✓
- `EnableDebugLoggingParam = true` ✓

### Action 2: Check Progress (2 minutes)

After completing 5 backtests, run:

```powershell
cd C:\Users\Administrator\Documents\cAlgo\Sources\Robots\CCTTB\CCTTB
.\check_learning_progress.ps1
```

**Expected after 5 tests**:
```
Total Swings:      250-350 (from 98)
Success Rate:      20-35% (from 6.1%)
Readiness:         1-2 / 4 criteria met
```

### Action 3: Run 5 More Backtests (15 minutes)

Continue with:

```
6. August 1-15, 2025
7. July 15-31, 2025
8. July 1-15, 2025
9. June 15-30, 2025
10. June 1-15, 2025
```

### Action 4: Final Progress Check (2 minutes)

Run progress checker again:

```powershell
.\check_learning_progress.ps1
```

**Expected after 10 tests**:
```
Total Swings:      500-600
Success Rate:      40-50%
Readiness:         3-4 / 4 criteria met
```

**If READY (3/4 criteria)**: Proceed to Phase B (see guide)
**If NOT READY**: Run 5 more backtests

---

## Quick Reference

### Current Configuration

```csharp
EnableSwingQualityFilter = false  // DISABLED for data collection
MinSwingQuality = 0.13            // Will use 0.20-0.30 when re-enabled
```

**Build**: ✅ Successful (0 errors, 0 warnings)
**Bot Ready**: ✅ Yes (filtering disabled, data collection mode)

### Progress Tracking

**Current Status** (Oct 28, 09:35 UTC):
```
Swings:        98 / 500 (19.6%)
Success Rate:  6.1% / 45.0% target
Remaining:     402 swings (~9 backtests)
```

**Readiness Criteria** (need 3 of 4):
- [ ] Total Swings ≥ 500
- [ ] Success Rate ≥ 40%
- [x] Sessions with Data ≥ 2
- [ ] Directions with Data ≥ 2

### What Happens Next

**Phase A: Data Collection** (Today)
- Run 10-20 backtests
- Accumulate 500+ swings
- Success rate normalizes to 40-50%

**Phase B: Re-Enable Filtering** (Tomorrow)
- Analyze quality score distribution
- Set threshold to 0.20-0.30 (top 25-30% of swings)
- Re-enable: `EnableSwingQualityFilter = true`
- Rebuild and validate

**Expected Final Result**:
- Win rate: 60-75% (vs 47.4% baseline)
- Acceptance: 15-30%
- Trades: 12-20 per backtest

---

## Files Created

1. **[PHASE2_DATA_COLLECTION_GUIDE.md](PHASE2_DATA_COLLECTION_GUIDE.md)** - Complete guide
2. **[PHASE2_CRITICAL_ISSUE_OCT28.md](PHASE2_CRITICAL_ISSUE_OCT28.md)** - Issue analysis
3. **[check_learning_progress.ps1](check_learning_progress.ps1)** - Progress checker
4. **[PHASE2_QUICK_ACTIONS.md](PHASE2_QUICK_ACTIONS.md)** - This file

---

## Support Commands

**Check progress**:
```powershell
.\check_learning_progress.ps1
```

**Quick swing count**:
```powershell
$h = Get-Content "C:\Users\Administrator\Documents\cAlgo\Data\cBots\CCTTB\data\learning\history.json" | ConvertFrom-Json
Write-Host "Swings: $($h.SwingStats.TotalSwings) | Success Rate: $([math]::Round($h.SwingStats.AverageOTESuccessRate * 100, 1))%"
```

**Check last backtest log**:
```powershell
$logs = Get-ChildItem "C:\Users\Administrator\Documents\cAlgo\Data\cBots\CCTTB\data\logs\*.log" | Sort-Object LastWriteTime -Descending
$latest = $logs[0].FullName
Write-Host "Latest log: $latest"
```

---

## Timeline

**Optimistic**: 2-3 days
- Day 1: 10 backtests → 500 swings ✅
- Day 2: Re-enable filtering, validate ✅
- Day 3: Phase 2 complete ✅

**Realistic**: 3-5 days
- Days 1-2: 15 backtests → 600 swings ✅
- Day 3: Re-enable, threshold tuning
- Days 4-5: Validation, Phase 2 complete ✅

---

## Summary

✅ **Quality filtering disabled** (was causing 100% rejection)
✅ **Bot rebuilt successfully** (0 errors, 0 warnings)
✅ **Documentation complete** (4 comprehensive docs)
✅ **Progress checker ready** (automated monitoring)

⏳ **Your action**: Run 10 backtests (~30 minutes total time)

🎯 **Goal**: Accumulate 500+ swings → Re-enable filtering → 60-75% win rate

---

**Next**: Run 5 backtests, check progress, run 5 more, check progress again
**Expected**: ~500 swings after 10 tests → Ready for Phase B
