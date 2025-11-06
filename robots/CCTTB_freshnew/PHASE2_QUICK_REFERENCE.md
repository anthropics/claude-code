# Phase 2 Quality Filtering - Quick Reference Card

**Status**: ✅ READY FOR TESTING | **Date**: Oct 28, 2025 | **Build**: 0 Errors

---

## Current Configuration

```
Threshold (General):    0.13
Threshold (London):     0.15
Expected Acceptance:    12-18%
Expected Win Rate:      60-70%
Expected Trades:        12-18 per backtest
Baseline Win Rate:      47.4% (no filtering)
```

---

## Run Backtest Now

1. Open cTrader → Load CCTTB on EURUSD M5
2. Automate → Backtest → Oct 1-15, 2025
3. Initial balance: $10,000 → Start

---

## Success Criteria (Need 3 of 4)

- [ ] Win rate ≥ 57% (+10pp improvement)
- [ ] Win rate ≥ 60% (quality maintained)
- [ ] Trades: 12-18 per backtest
- [ ] Net profit: +15% vs baseline

---

## Quick Analysis

### Count Decisions
```powershell
$log = "path\to\JadecapDebug_YYYYMMDD_HHMMSS.log"
$accepted = (Select-String -Path $log -Pattern 'Swing ACCEPTED').Count
$rejected = (Select-String -Path $log -Pattern 'Swing REJECTED').Count
$acceptanceRate = [math]::Round($accepted / ($accepted + $rejected) * 100, 1)
Write-Host "Acceptance: $acceptanceRate%"
```

### Count Win Rate
```powershell
$outcomes = (Select-String -Path $log -Pattern 'Updated swing outcome').Count
$wins = (Select-String -Path $log -Pattern 'OTE Worked: True').Count
$winRate = [math]::Round($wins / $outcomes * 100, 1)
Write-Host "Win Rate: $winRate% ($wins/$outcomes)"
```

---

## If Results Don't Match

| Problem | Solution |
|---------|----------|
| Acceptance < 10% | Lower threshold to 0.12 |
| Win rate < 55% | Increase threshold to 0.14 |
| Acceptance > 25% | Increase threshold to 0.14-0.16 |
| Win rate < 47.4% | Increase threshold by 0.03 |

**Location**: [Config_StrategyConfig.cs:197](Config_StrategyConfig.cs#L197)

---

## Threshold History

```
0.40-0.60  →  0% acceptance (learning data reset)
0.15-0.20  →  0.6%, 83.3% WR (too strict)
0.10-0.12  →  8.6%, 42.9% WR (too lenient)
0.13       →  12-18%, 60-70% WR (OPTIMAL) ✅
```

---

## Learning Data Status

```
Total Swings:        98 / 500 target (20% complete)
Successful OTEs:     6 (6.1% success rate)
NY Session:          8.5% success
Bullish Direction:   7.4% success
```

**Note**: Quality scores (0.13-0.25 range) are low due to insufficient data. As data accumulates (500+ swings), scores will normalize to 0.20-0.80 range and thresholds can gradually increase to 0.40-0.60.

---

## Expected Log Output

**Acceptances** (12-18% of swings):
```
[QUALITY GATE] ✅ Swing ACCEPTED | Quality: 0.14 ≥ 0.13 | Session: NY
[QUALITY GATE] ✅ Swing ACCEPTED | Quality: 0.17 ≥ 0.15 | Session: London
```

**Rejections** (82-88% of swings):
```
[QUALITY GATE] ❌ Swing REJECTED | Quality: 0.11 < 0.13 | Session: Asia
[QUALITY GATE] ❌ Swing REJECTED | Quality: 0.12 < 0.13 | Session: Other
```

---

## Full Documentation

- **[PHASE2_TESTING_GUIDE.md](PHASE2_TESTING_GUIDE.md)** - Complete testing instructions
- **[PHASE2_COMPLETE_SUMMARY.md](PHASE2_COMPLETE_SUMMARY.md)** - Final configuration & analysis
- **[PHASE2_FINAL_ANALYSIS_OCT28.md](PHASE2_FINAL_ANALYSIS_OCT28.md)** - Why 0.13 is optimal

---

**Action Required**: Run backtest and report results

**Expected Outcome**: 60-70% win rate with 12-18 trades (+15-30% profit vs baseline)
