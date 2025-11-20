# Phase 2 - Data Collection Phase Guide

**Date**: October 28, 2025
**Status**: 🔄 **DATA COLLECTION IN PROGRESS**
**Goal**: Accumulate 500+ swings to enable proper quality filtering

---

## Quick Start

### What Changed

**Quality filtering is now DISABLED** to allow data collection:
```csharp
EnableSwingQualityFilter = false  // Was true, now false
```

**Why**: All quality scores were 0.10 (below 0.13 threshold) → 100% rejection → No trades → No data collection → Chicken-and-egg problem

**Solution**: Temporarily run without filtering to accumulate 400-500 new swings, then re-enable

---

## Data Collection Plan

### Phase A: Bulk Data Collection (1-2 Days)

**Target**: Run 10-20 backtests to accumulate 400-500 swings

**Recommended Backtest Periods**:
1. September 1-15, 2025
2. September 15-30, 2025
3. October 1-15, 2025
4. October 15-31, 2025
5. August 15-31, 2025
6. August 1-15, 2025

**Settings for Each Backtest**:
- Symbol: EURUSD
- Timeframe: M5
- Initial Balance: $10,000
- Period: 2 weeks each (sufficient for 40-60 swings per test)

**Expected Results Per Backtest**:
- Swings recorded: 40-60
- Trades executed: 30-40
- Win rate: 45-50% (baseline)
- Learning data accumulates in history.json

---

## Step-by-Step Instructions

### Step 1: Run First Batch (5 Backtests)

1. Open cTrader Automate
2. Load CCTTB bot on EURUSD M5 chart
3. **Verify bot parameters**:
   - `EnableAdaptiveLearning = true` ✓
   - `EnableDebugLoggingParam = true` ✓
4. Open Backtest (Automate → Backtest)
5. Configure backtest:
   - **Period**: September 1-15, 2025
   - **Initial Balance**: $10,000
6. Click **Start** and wait for completion (~2-3 minutes)
7. Repeat for remaining 4 periods

**Time Required**: ~15-20 minutes for 5 backtests

### Step 2: Verify Data Accumulation

After completing the first 5 backtests, check learning data:

**PowerShell Command**:
```powershell
$history = Get-Content "C:\Users\Administrator\Documents\cAlgo\Data\cBots\CCTTB\data\learning\history.json" | ConvertFrom-Json
Write-Host "Total Swings: $($history.SwingStats.TotalSwings)"
Write-Host "Successful OTEs: $($history.SwingStats.SuccessfulOTEs)"
$successRate = [math]::Round($history.SwingStats.AverageOTESuccessRate * 100, 1)
Write-Host "Success Rate: $successRate%"
```

**Expected After 5 Backtests**:
```
Total Swings: 250-350 (was 98)
Successful OTEs: 110-175 (was 6)
Success Rate: 40-50% (was 6.1%)
```

**If success rate is still < 20%**:
- Run 5 more backtests (total: 10)
- Success rate should normalize to 40-50% with 400+ swings

### Step 3: Run Second Batch (5-10 More Backtests)

Continue running backtests until:
- **Total Swings ≥ 500**
- **Success Rate ≥ 40%**

**Recommended Additional Periods**:
7. July 15-31, 2025
8. July 1-15, 2025
9. June 15-30, 2025
10. June 1-15, 2025

**Time Required**: ~15-30 minutes for 5-10 backtests

### Step 4: Validate Quality Score Distribution

Once you have 500+ swings, run ONE test backtest to check quality scores:

**Purpose**: Verify quality scores are no longer clustered at 0.10

**How**:
1. Temporarily re-enable debug logging for quality gate:
   - Keep `EnableSwingQualityFilter = false`
   - Set `EnableDebugLoggingParam = true`
2. Run a backtest (any 2-week period)
3. Search log for quality calculations

**What to Look For**:
```
Quality scores should now range 0.15-0.40 (not all 0.10)
Example:
  Quality: 0.18
  Quality: 0.25
  Quality: 0.16
  Quality: 0.32
  Quality: 0.21
```

**If still seeing only 0.10-0.12**:
- Need more data (run 5-10 more backtests)
- Target: 800-1000 swings for full normalization

**If seeing 0.15-0.40 range** ✅:
- Proceed to Phase B (re-enable filtering)

---

## Phase B: Re-Enable Quality Filtering (1 Day)

### Step 1: Analyze Quality Score Distribution

Use the validation test log to determine optimal threshold:

**PowerShell Analysis**:
```powershell
$log = "C:\Users\Administrator\Documents\cAlgo\Data\cBots\CCTTB\data\logs\JadecapDebug_YYYYMMDD_HHMMSS.log"

# Extract quality scores (if you added debug logging)
$qualityLines = Select-String -Path $log -Pattern "Swing quality: ([0-9.]+)" | ForEach-Object { $_.Matches.Groups[1].Value }

if ($qualityLines.Count -gt 0) {
    $scores = $qualityLines | ForEach-Object { [double]$_ }
    $min = ($scores | Measure-Object -Minimum).Minimum
    $max = ($scores | Measure-Object -Maximum).Maximum
    $avg = [math]::Round(($scores | Measure-Object -Average).Average, 3)
    $median = ($scores | Sort-Object)[[math]::Floor($scores.Count / 2)]

    Write-Host "Quality Score Distribution:"
    Write-Host "  Min:    $min"
    Write-Host "  Max:    $max"
    Write-Host "  Avg:    $avg"
    Write-Host "  Median: $median"

    # Percentiles
    $p25 = ($scores | Sort-Object)[[math]::Floor($scores.Count * 0.25)]
    $p50 = ($scores | Sort-Object)[[math]::Floor($scores.Count * 0.50)]
    $p75 = ($scores | Sort-Object)[[math]::Floor($scores.Count * 0.75)]
    $p90 = ($scores | Sort-Object)[[math]::Floor($scores.Count * 0.90)]

    Write-Host ""
    Write-Host "Percentiles:"
    Write-Host "  25th: $p25"
    Write-Host "  50th: $p50 (median)"
    Write-Host "  75th: $p75"
    Write-Host "  90th: $p90"

    Write-Host ""
    Write-Host "Recommended Threshold: $p75 (accepts top 25% of swings)"
}
```

**Expected Output**:
```
Quality Score Distribution:
  Min:    0.15
  Max:    0.42
  Avg:    0.268
  Median: 0.26

Percentiles:
  25th: 0.20
  50th: 0.26
  75th: 0.32
  90th: 0.38

Recommended Threshold: 0.32 (accepts top 25% of swings)
```

### Step 2: Set Optimal Threshold

Based on quality distribution, set threshold:

**If average quality is 0.25-0.30**:
- **Threshold**: 0.20-0.25 (accepts top 30-50%)
- **Expected**: 20-30% acceptance, 60-70% win rate

**If average quality is 0.30-0.35**:
- **Threshold**: 0.25-0.30 (accepts top 20-40%)
- **Expected**: 15-25% acceptance, 65-75% win rate

**Edit Config_StrategyConfig.cs**:
```csharp
public bool     EnableSwingQualityFilter { get; set; } = true;   // RE-ENABLE
public double   MinSwingQuality { get; set; } = 0.25;            // Set based on analysis
public double   MinSwingQualityLondon { get; set; } = 0.28;      // +0.03 stricter for London
```

### Step 3: Rebuild Bot

```bash
cd C:\Users\Administrator\Documents\cAlgo\Sources\Robots\CCTTB\CCTTB
dotnet build --configuration Debug
```

### Step 4: Run Validation Backtest

Run ONE backtest to validate quality filtering:

**Settings**:
- Period: October 1-15, 2025 (reference period)
- Initial Balance: $10,000

**Expected Results**:
- Acceptance Rate: 15-30%
- Win Rate: 60-75%
- Trades: 12-20

**Success Criteria** (need 3 of 4):
- [ ] Win rate ≥ 57% (+10pp vs 47.4% baseline)
- [ ] Win rate ≥ 60% (quality maintained)
- [ ] Trades: 12-20
- [ ] Net profit: +15% vs baseline

**If 3/4 criteria met** ✅:
- **Phase 2 COMPLETE!**
- Proceed to long-term monitoring

**If criteria not met**:
- Adjust threshold by ±0.03
- Re-test
- Iterate until optimal

---

## Progress Tracking

### Current Status (Starting Point)

**Learning Data** (Oct 28, 09:22 UTC):
```
Total Swings:        98
Successful OTEs:     6
Success Rate:        6.1%
Quality Score Range: 0.10 (all swings)
```

**Status**: ⏳ Need 400-500 more swings

### Milestone 1: First 5 Backtests

**Target**:
```
Total Swings:        250-350
Success Rate:        15-25%
Quality Score Range: 0.10-0.15
```

**Status**: ⏳ Pending

### Milestone 2: Next 5-10 Backtests

**Target**:
```
Total Swings:        500-600
Success Rate:        40-50%
Quality Score Range: 0.15-0.40
```

**Status**: ⏳ Pending

### Milestone 3: Re-Enable Filtering

**Target**:
```
Threshold:           0.20-0.30 (based on distribution)
Acceptance Rate:     15-30%
Win Rate:            60-75%
```

**Status**: ⏳ Pending

### Final Goal: Phase 2 Complete ✅

**Target**:
```
Total Swings:        500+
Success Rate:        45-50%
Win Rate (Filtered): 60-75%
Acceptance Rate:     15-30%
Net Profit:          +15-30% vs baseline
```

**Status**: ⏳ Pending

---

## Data Collection Cheat Sheet

### Quick Commands

**Check Learning Data**:
```powershell
$h = Get-Content "C:\Users\Administrator\Documents\cAlgo\Data\cBots\CCTTB\data\learning\history.json" | ConvertFrom-Json
Write-Host "Swings: $($h.SwingStats.TotalSwings) | Success Rate: $([math]::Round($h.SwingStats.AverageOTESuccessRate * 100, 1))%"
```

**Count Swings Per Session**:
```powershell
$h = Get-Content "C:\Users\Administrator\Documents\cAlgo\Data\cBots\CCTTB\data\learning\history.json" | ConvertFrom-Json
$h.SwingStats.SuccessRateBySession | Format-Table
```

**Monitor Data Growth**:
```powershell
# Run this before and after each batch of backtests
$h = Get-Content "C:\Users\Administrator\Documents\cAlgo\Data\cBots\CCTTB\data\learning\history.json" | ConvertFrom-Json
$swings = $h.SwingStats.TotalSwings
$target = 500
$remaining = $target - $swings
$progress = [math]::Round(($swings / $target) * 100, 1)
Write-Host "Progress: $swings / $target swings ($progress%)"
Write-Host "Remaining: $remaining swings"
Write-Host "Estimated backtests needed: $([math]::Ceiling($remaining / 50))"
```

---

## Troubleshooting

### Issue 1: Success Rate Not Improving

**Symptom**: After 5-10 backtests, success rate still < 20%

**Causes**:
1. Bot parameters: `EnableAdaptiveLearning = false`
2. Backtest periods too short (need 2 weeks minimum)
3. Not enough backtests run

**Solution**:
- Verify `EnableAdaptiveLearning = true` in bot parameters
- Run longer backtest periods (2-4 weeks)
- Run 10-15 more backtests

### Issue 2: Total Swings Not Increasing

**Symptom**: `TotalSwings` stays at 98 after running backtests

**Causes**:
1. Bot not recording swings (check debug log)
2. `EnableAdaptiveLearning = false`
3. history.json file locked or read-only

**Solution**:
- Check log for `[SWING LEARNING] Recorded swing` messages
- Enable adaptive learning in bot parameters
- Check file permissions on history.json

### Issue 3: Quality Scores Still 0.10 After 500 Swings

**Symptom**: Even with 500+ swings, quality scores remain 0.10

**Cause**: Success rate still < 10% (extremely rare)

**Solution**:
- Run 10 more backtests (may need 1000+ swings)
- Check if bot is executing trades correctly
- Verify baseline performance is working (47.4% WR expected)

---

## Expected Timeline

### Optimistic (2-3 Days)

- **Day 1**: Run 10 backtests → 500 swings, 45% success rate
- **Day 2**: Validate quality distribution → Re-enable filtering with threshold 0.20
- **Day 3**: Run validation backtest → 65% win rate ✅ Phase 2 complete

### Realistic (3-5 Days)

- **Day 1**: Run 10 backtests → 450 swings, 35% success rate
- **Day 2**: Run 5 more backtests → 550 swings, 45% success rate
- **Day 3**: Validate quality distribution → Re-enable filtering with threshold 0.22
- **Day 4**: Run validation backtest → 62% win rate → Adjust threshold to 0.20
- **Day 5**: Re-test → 68% win rate ✅ Phase 2 complete

### Conservative (5-7 Days)

- **Days 1-3**: Run 20 backtests → 800 swings, 48% success rate
- **Day 4**: Validate quality distribution → Re-enable filtering with threshold 0.25
- **Day 5**: Run validation backtest → 58% win rate → Adjust threshold to 0.22
- **Day 6**: Re-test → 64% win rate → Adjust to 0.20
- **Day 7**: Final test → 70% win rate ✅ Phase 2 complete

---

## What to Expect

### During Data Collection (Quality Filter OFF)

**Performance**: Baseline (same as before Phase 2)
```
Win Rate:        45-50%
Trades/Test:     30-40
Net Profit:      +$80-120 per backtest
Quality:         No filtering (all swings accepted)
```

**Purpose**: Accumulating training data for quality scoring

### After Re-Enabling Filtering

**Performance**: Improved (Phase 2 goal)
```
Win Rate:        60-75% (+10-25pp improvement!)
Trades/Test:     12-20 (quality over quantity)
Net Profit:      +$100-150 per backtest (+20-30%)
Quality:         Top 15-30% of swings only
```

**Purpose**: Trading only high-quality setups

---

## Next Steps After Data Collection

Once you have 500+ swings and quality filtering re-enabled:

1. **Run 5-10 validation backtests** to confirm stability
2. **Fine-tune threshold** if needed (±0.02-0.05 adjustments)
3. **Monitor session-specific performance**:
   - If London still underperforms: Increase `MinSwingQualityLondon` to 0.28-0.30
   - If NY overperforms: Can lower `MinSwingQualityNY` to 0.18-0.20
4. **Document final configuration** in PHASE2_COMPLETE_FINAL.md
5. **Proceed to Phase 3** (advanced features):
   - Multi-arm bandit threshold optimization
   - Ensemble quality models
   - Real-time quality adaptation

---

## Summary

**Current Status**: Quality filtering DISABLED for data collection

**Goal**: Accumulate 500+ swings with 45-50% success rate

**Action Required**:
1. Run 10-20 backtests (2-week periods each)
2. Verify 500+ swings collected
3. Re-enable filtering with threshold 0.20-0.30
4. Validate 60-75% win rate

**Timeline**: 2-5 days total

**Expected Final Result**: Phase 2 complete with 60-75% win rate (vs 47.4% baseline)

---

**Status**: 🔄 **DATA COLLECTION IN PROGRESS**
**Next Action**: Run first 5 backtests and verify data accumulation
**Documentation**: [PHASE2_CRITICAL_ISSUE_OCT28.md](PHASE2_CRITICAL_ISSUE_OCT28.md) for full context
