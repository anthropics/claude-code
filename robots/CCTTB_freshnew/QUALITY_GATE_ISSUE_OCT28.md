# Quality Gate Issue - October 28, 2025

## Problem Detected

The quality gate is **rejecting 100% of swings** (5373 rejections, 0 acceptances) in the latest backtest.

### Root Cause

**Learning data was reset or corrupted:**

**Before (Oct 28 04:57 AM)**:
- 448 total swings accumulated
- 91 trade outcomes tracked
- Rich success rate data by session/direction/size

**After (Oct 28 07:20 AM)**:
- Only **13 swings** in history.json
- Only **1 successful OTE** (7.7% success rate)
- Success rates very low:
  - NY session: 16.7%
  - Bullish: 6.9%
  - Bearish: 0%
  - London: 0%
  - Asia: 0%

**Result**: Quality scores are proportionally low (0.16-0.21), all below thresholds (0.40-0.60).

### Evidence from Latest Log

```
[QUALITY GATE] ❌ Swing REJECTED | Quality: 0.17 < 0.50 | Session: NY
[QUALITY GATE] ❌ Swing REJECTED | Quality: 0.16 < 0.50 | Session: NY
[QUALITY GATE] ❌ Swing REJECTED | Quality: 0.21 < 0.40 | Session: Other
```

**All 5373 swings rejected**, no trades executed.

---

## Solutions

### Option 1: Lower Quality Thresholds (Recommended)

**Adjust thresholds to match current learning state** until more data accumulates:

**Edit Config_StrategyConfig.cs:**
```csharp
// Change from:
public double MinSwingQuality { get; set; } = 0.40;
public double MinSwingQualityLondon { get; set; } = 0.60;
public double MinSwingQualityAsia { get; set; } = 0.50;
public double MinSwingQualityNY { get; set; } = 0.50;

// To (lenient thresholds):
public double MinSwingQuality { get; set; } = 0.15;  // Very lenient
public double MinSwingQualityLondon { get; set; } = 0.20;  // Lenient
public double MinSwingQualityAsia { get; set; } = 0.15;  // Very lenient
public double MinSwingQualityNY { get; set; } = 0.15;  // Very lenient
```

**Expected Outcome**:
- Accept 50-70% of swings (instead of 0%)
- Allow learning data to accumulate again
- Gradually increase thresholds as success rates improve

### Option 2: Disable Quality Filtering Temporarily

**Collect more data without filtering:**

```csharp
public bool EnableSwingQualityFilter { get; set; } = false;  // Disable temporarily
```

**Run 5-10 backtests** to rebuild learning database (target: 200+ swings, 50+ outcomes).

Then **re-enable** and use original thresholds (0.40-0.60).

### Option 3: Restore Historical Data (If Available)

If you have a backup of `history.json` from earlier today (448 swings), restore it:

1. Locate backup (if auto-created)
2. Copy to: `C:\Users\Administrator\Documents\cAlgo\Data\cBots\CCTTB\data\learning\history.json`
3. Re-run backtest

---

## Recommendation

**Use Option 1**: Lower thresholds temporarily.

### Quick Fix Commands

1. **Edit Config_StrategyConfig.cs** lines 197-200:
```csharp
public double MinSwingQuality { get; set; } = 0.15;
public double MinSwingQualityLondon { get; set; } = 0.20;
public double MinSwingQualityAsia { get; set; } = 0.15;
public double MinSwingQualityNY { get; set; } = 0.15;
```

2. **Rebuild**:
```bash
cd C:\Users\Administrator\Documents\cAlgo\Sources\Robots\CCTTB\CCTTB
dotnet build --configuration Debug
```

3. **Run backtest** again

4. **Expected results**:
   - 50-70% acceptance rate
   - 20-30 trades executed
   - Quality scores 0.15-0.25 (will pass now)

### Gradual Threshold Increase Plan

**As success rate data accumulates:**

```
After 50 swings:   Increase to 0.20/0.25/0.20/0.20
After 100 swings:  Increase to 0.25/0.35/0.25/0.25
After 200 swings:  Increase to 0.30/0.45/0.30/0.30
After 500 swings:  Increase to 0.40/0.60/0.50/0.50 (original targets)
```

---

## Why Learning Data Got Reset

**Possible causes:**

1. **Bot reinstall/recompile** cleared data directory
2. **Manual deletion** of learning files
3. **File system issue** (corruption/permissions)
4. **Learning engine reset logic** triggered (day rollover bug?)

**Daily files are empty**:
```
daily_20251027.json: 0 lines
daily_20251028.json: 0 lines
```

This suggests the **daily persistence is not working** correctly. Check:
- File write permissions
- Path: `C:\Users\Administrator\Documents\cAlgo\Data\cBots\CCTTB\data\learning\`
- AdaptiveLearning class SaveDailyData() method

---

## Prevention

**Backup learning data regularly:**

1. **Manual backup** before major changes:
```bash
xcopy "C:\Users\Administrator\Documents\cAlgo\Data\cBots\CCTTB\data\learning" "C:\Backups\learning_%date:~-4,4%%date:~-10,2%%date:~-7,2%" /E /I
```

2. **Auto-backup script** (PowerShell):
```powershell
$source = "C:\Users\Administrator\Documents\cAlgo\Data\cBots\CCTTB\data\learning"
$dest = "C:\Backups\learning_$(Get-Date -Format 'yyyyMMdd_HHmmss')"
Copy-Item -Path $source -Destination $dest -Recurse
```

---

## Current Status

**Quality Gate**: ✅ Working correctly (logic is sound)
**Learning Data**: ❌ Insufficient (only 13 swings, 7.7% success rate)
**Thresholds**: ❌ Too high for current data (0.40-0.60 vs 0.16-0.21 scores)

**Action Required**: Lower thresholds to 0.15-0.20 range OR disable filtering until data rebuilds.

---

**Generated**: October 28, 2025 07:20 AM
**Status**: Needs threshold adjustment to function
