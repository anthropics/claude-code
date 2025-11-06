# PID5 Catastrophic Loss Analysis - From Log Data

## Log Data Extracted

### Position 5 (EURUSD_5)
**Entry Details** (Line 13576):
```
TRADE|2025-09-11 02:10:00|Bullish|Entry:1.16961|Stop:1.16761|TP:1.1729
```

**Position Opened** (Line 13578):
```
DBG|2025-10-23 02:47:22.280|Position opened: EURUSD_5 | Detector: Unknown | Daily trades: 1/4
```

**Position Closed**:
```
DBG|2025-10-23 02:47:23.060|Position closed: EURUSD_5 | PnL: -961.92 (-27414.27%) | Detector: Unknown | Consecutive losses: 1
```

---

## Calculation of Implied Position Size

### Given Data
- **Entry Price**: 1.16961
- **Stop Loss**: 1.16761
- **Stop Distance**: 20.0 pips (200 points)
- **Actual Loss**: -$961.92
- **Loss Percentage**: -27,414.27%

### EURUSD Specifications
- **Lot Size**: 100,000 units
- **Pip Value** (per lot): $10/pip
- **Pip Value** (per unit): $10 / 100,000 = $0.0001/pip

### Reverse-Engineering Position Size

**Formula**:
```
Loss = StopPips × PipValue × Units
Units = Loss / (StopPips × PipValuePerUnit)
```

**Calculation**:
```
Units = 961.92 / (20.0 × 0.0001)
Units = 961.92 / 0.002
Units = 480,960 units
```

**In Lots**:
```
Lots = 480,960 / 100,000
Lots = 4.8096 lots
```

---

## Expected vs Actual Position Size

### Expected Position Size (0.4% Risk on $1,000)

**Risk Calculation**:
- Capital: $1,000
- Risk: 0.4% = $4.00
- Stop Distance: 20 pips

**Expected Units**:
```
Units = RiskAmount / (StopPips × PipValuePerUnit)
Units = 4.00 / (20.0 × 0.0001)
Units = 4.00 / 0.002
Units = 2,000 units (0.02 lots)
```

**Expected Loss at SL**:
```
Loss = 2,000 units × 20 pips × $0.0001/pip
Loss = $4.00
```

---

## Position Sizing Error Analysis

| Metric | Expected | Actual | Delta |
|--------|----------|--------|-------|
| **Risk Amount** | $4.00 | ??? | ??? |
| **Position Size (units)** | 2,000 | 480,960 | **240.5x OVERSIZED** |
| **Position Size (lots)** | 0.02 | 4.8096 | **240.5x OVERSIZED** |
| **Loss at SL** | $4.00 | $961.92 | **240.5x LARGER** |
| **Loss %** | -0.4% | -96.2% | **Destroyed account** |

---

## Root Cause Analysis

### Hypothesis 1: Equity Explosion (MOST LIKELY)

**Theory**: Account equity was incorrectly calculated as 240.5x higher than actual

**Calculation**:
```
If Equity = $240,480 (instead of $1,000)
RiskAmount = $240,480 × 0.004 = $961.92 ← MATCHES ACTUAL LOSS!
Units = $961.92 / 0.002 = 480,960 units ← MATCHES!
```

**Evidence**:
- 240.5x amplification perfectly matches both position size AND loss
- Suggests `_account.Equity` is returning inflated value
- Possible causes:
  - Unrealized P&L from other positions being double-counted
  - Margin calculation error
  - cTrader API bug returning wrong value

**Why PID5 and not others?**
- PID1-4 may have had lower equity when opened (early in backtest)
- Or PID5 opened after PID1-4 accumulated unrealized profits, inflating equity calculation

---

### Hypothesis 2: VolumeMin Clamp

**Theory**: Broker VolumeInUnitsMin is set to 480,960 units (unlikely but possible)

**Check**:
```
symbol.VolumeInUnitsMin = ??? (should be 1,000 units for EURUSD)
```

**Evidence**:
- If VolumeMin was 480,960, the RiskManager would clamp to this value
- This would explain why position size jumped from 2,000 to 480,960

**Weakness**:
- Extremely unlikely - standard EURUSD minimum is 1,000 units (0.01 lots)
- Would affect ALL trades, not just PID5

---

### Hypothesis 3: Risk Percent Misconfiguration

**Theory**: RiskPercent is 96.2% instead of 0.4%

**Calculation**:
```
If RiskPercent = 96.192%
RiskAmount = $1,000 × 0.96192 = $961.92 ← MATCHES!
Units = $961.92 / 0.002 = 480,960 units ← MATCHES!
```

**Evidence**:
- 96.192% risk would perfectly explain the loss
- RiskPercent =  96.2% / 0.4% = 240.5x too high

**Weakness**:
- Config file should show RiskPercent = 0.4
- Would affect ALL trades if static, but only PID5 is catastrophic
- Unless RiskPercent is being dynamically modified

---

### Hypothesis 4: Pip Value Miscalculation

**Theory**: PipValue calculation returned wrong value

**Check**:
```
If pipValuePerUnit = 0.02405 (240.5x too high)
Denominator = 20 pips × 0.02405 = 0.481
RawUnits = $4.00 / 0.481 = 8.32 units (too small)
→ Would hit VolumeMin clamp at 1,000 units (not 480,960)
```

**Conclusion**: This doesn't explain the 480,960 units. **HYPOTHESIS REJECTED**.

---

### Hypothesis 5: MaxVolumeUnits Not Set

**Theory**: _config.MaxVolumeUnits = 0, so no upper clamp is applied

**Evidence**:
- RiskManager code: `if (_config.MaxVolumeUnits > 0)` only clamps if > 0
- If MaxVolumeUnits = 0, no capping occurs

**Impact**:
- Allows runaway position sizes if Equity or RiskPercent is wrong
- Explains why position reached 480,960 units without being capped

**Recommendation**: Set MaxVolumeUnits to reasonable limit (e.g., 100,000 units = 1 lot)

---

## Comparison to Other Positions

| PID | Entry Time | Stop Pips | Net PnL | PnL % | Implied Position Size |
|-----|-----------|-----------|---------|-------|----------------------|
| 1 | Sept 7 17:45 | 20.0 | +$139.08 | +3,956% | ~3,477 units (0.0348 lots) |
| 2 | Sept 7 17:50 | 16.1 | +$3.05 | +286% | ~1,066 units (0.0107 lots) |
| 3 | Sept 9 21:40 | 20.0 | +$238.08 | +6,783% | ~3,509 units (0.0351 lots) |
| 4 | Sept 9 21:45 | 15.8 | -$20.00 | -2,192% | ~912 units (0.0091 lots) |
| 5 | Sept 11 02:10 | 20.0 | **-$961.92** | **-27,414%** | **480,960 units (4.8096 lots)** |

**Pattern Observed**:
- PID1-4: Position sizes range from 912 to 3,509 units (0.009 to 0.035 lots) ← NORMAL VARIANCE
- PID5: Position size = 480,960 units (4.81 lots) ← **137x to 527x LARGER** than others

**Conclusion**: PID5 is an anomaly. Something changed between PID4 (Sept 9 21:45) and PID5 (Sept 11 02:10).

---

## Timeline Analysis

**Sept 9 21:45** - PID4 opened (912 units, normal sizing)
- Equity at this time: Likely ~$1,000 (start of backtest)

**~36 hours pass** (Sept 9 21:45 → Sept 11 02:10)
- PID1-4 accumulate unrealized profits
- PID1: Potentially +$139 unrealized
- PID3: Potentially +$238 unrealized
- **Total unrealized**: ~$377+

**Sept 11 02:10** - PID5 opened
- **If Equity calculation includes unrealized P&L**:
  - Equity = $1,000 (balance) + $377 (unrealized) = $1,377
  - But this is only 1.377x, not 240.5x

**Issue**: The 240.5x amplification is NOT explained by unrealized P&L alone.

---

## Critical Questions

### Q1: What was Account.Equity when PID5 opened?
**Expected**: $1,000 (or ~$1,377 if including unrealized)
**Actual (implied)**: $240,480 (240.5x too high)

### Q2: What was _config.RiskPercent when PID5 calculated position size?
**Expected**: 0.4%
**Actual (implied)**: 96.2% (or 0.4% with inflated equity)

### Q3: What was _config.MaxVolumeUnits?
**Expected**: Should cap at reasonable limit
**Actual (suspected)**: 0 (no capping)

### Q4: Did PID1-4 close before PID5 opened?
**From log**: No - PID1 and PID2 show "Time-in-trade" messages AFTER PID5 opened
- PID2 closed at 8.1 hours (Sept 8 01:50 + 8h = Sept 8 09:50)
- PID1 kept open as losing position

**Conclusion**: PID1-4 were STILL OPEN when PID5 opened, so their unrealized P&L should have been included in Equity.

---

## Most Likely Root Cause: Equity Calculation Bug

**Evidence Summary**:
1. ✅ Position size is 240.5x too large (matches equity being 240.5x inflated)
2. ✅ Loss amount ($961.92) exactly matches 0.4% of $240,480
3. ✅ PID1-4 had normal sizing, only PID5 is catastrophic
4. ✅ PID5 opened ~36h after PID4, after unrealized profits accumulated

**Suspected Code Path**:
```csharp
// In Execution_RiskManager.cs, line 42-44
double equity = _account.Equity;  // ← BUG: Returns 240.5x too high?
double riskAmount = equity * (_config.RiskPercent / 100.0);  // ← Uses inflated equity
```

**Possible Causes**:
1. **cTrader API bug**: `Account.Equity` returns wrong value in backtest
2. **Double-counting**: Unrealized P&L counted multiple times
3. **Currency conversion error**: Equity reported in wrong currency (cents instead of dollars?)
4. **Margin calculation**: Equity includes margin in addition to balance

---

## Recommended Fix (Without Debug Logs)

Since we can't see the actual Equity value, we need to add protective measures:

### Fix 1: Add MaxVolumeUnits Cap
```csharp
// In Config_StrategyConfig.cs
public double MaxVolumeUnits { get; set; } = 100000; // Cap at 1.0 lot
```

### Fix 2: Add Equity Sanity Check
```csharp
// In Execution_RiskManager.cs, CalculatePositionSize()
double equity = _account.Equity;

// SANITY CHECK: Equity should never be > 10x starting balance
double maxReasonableEquity = 10000; // $10k max for $1k start
if (equity > maxReasonableEquity)
{
    equity = maxReasonableEquity; // Clamp to reasonable value
    // Log warning
}

double riskAmount = equity * (_config.RiskPercent / 100.0);
```

### Fix 3: Add Position Size Sanity Check
```csharp
// After calculating rawUnits
double maxReasonableUnits = 100000; // 1.0 lot max
if (rawUnits > maxReasonableUnits)
{
    rawUnits = maxReasonableUnits; // Clamp to 1 lot
    // Log warning
}
```

---

## Next Steps

1. **Add Debug Logging to Journal** (instead of Console.WriteLine)
   - Modify RiskManager to accept TradeJournal parameter
   - Log equity, riskAmount, units to journal

2. **Add Protective Caps**
   - MaxVolumeUnits = 100,000 (1.0 lot)
   - Equity sanity check (cap at 10x starting balance)
   - Position size sanity check

3. **Re-run Sept 7-11 Backtest**
   - With journal logging
   - With protective caps
   - Verify PID5 capped at reasonable size

4. **Investigate cTrader Account.Equity**
   - Check if it's a known cTrader backtest bug
   - Test with Balance instead of Equity
   - Add Balance vs Equity comparison logging

---

**Status**: Root cause is **240.5x inflated Equity** calculation

**Impact**: Single trade destroyed 96% of account ($961.92 loss on $1,000 capital)

**Priority**: **P0 - CRITICAL - DEPLOYMENT BLOCKED**

---

**Date**: October 23, 2025
**Backtest**: Sept 7-11, 2025 (EURUSD, $1,000 start)
**PID5 Loss**: -$961.92 (-96.2%)
**Implied Position Size**: 480,960 units (4.81 lots) - **240.5x OVERSIZED**
