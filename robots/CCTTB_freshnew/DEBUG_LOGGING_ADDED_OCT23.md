# Debug Logging Added - Oct 23, 2025

## Purpose
Added comprehensive debug logging to diagnose the **PID5 catastrophic loss** (-$866.22 on a 20-pip stop loss that should have lost only ~$40).

---

## Files Modified

### 1. [Execution_RiskManager.cs](Execution_RiskManager.cs#L19-L122)

Added detailed logging to `CalculatePositionSize()` method to track every step of the position sizing calculation:

**Logging Added**:
- Entry parameters (entry price, stop loss, symbol)
- Mode selection (Fixed Lot Size vs Percentage-Based Risk)
- Account values (Equity, Balance)
- Risk calculation (RiskPercent, RiskAmount)
- Stop distance calculation (raw, clamped)
- Pip value calculation (per lot, per unit, with fallbacks)
- Volume calculation (denominator, raw units)
- Normalization and clamping steps
- **FINAL**: Expected loss at SL

**Example Output**:
```
═══════════════════════════════════════════════════════════════
[RISK CALC START] Entry=1.16960 SL=1.16760 Symbol=EURUSD
[RISK CALC] UnitsPerLot=100000 PipSize=0.0001
[RISK CALC] MODE: Percentage-Based Risk
[RISK CALC] Equity=$1000.00 Balance=$1000.00
[RISK CALC] RiskPercent=0.4% → RiskAmount=$4.00
[RISK CALC] StopDistance (raw)=20.00 pips
[RISK CALC] StopDistance (clamped)=20.00 pips
[RISK CALC] PipValuePerLot=$10.000000 → PipValuePerUnit=$0.00010000
[RISK CALC] Denominator = 20.00 pips × $0.00010000 = $0.002000
[RISK CALC] RawUnits = $4.00 / $0.002000 = 2000.00
[RISK CALC] Normalized: 2000.00 → 2000.00
[RISK CALC] After VolumeMin clamp (1000): 2000.00
[RISK CALC FINAL] Units=2000.00 (0.0200 lots)
[RISK CALC FINAL] Expected loss at SL = 20.00 pips × $0.00010000/unit × 2000.00 units = $4.00
═══════════════════════════════════════════════════════════════
```

---

### 2. [Execution_TradeManager.cs](Execution_TradeManager.cs#L157-L288)

Added logging to `ExecuteTrade()` method to track the actual trade execution:

**Logging Added**:
- Volume calculation call
- Returned volume value (units and lots)
- ExecuteMarketOrder parameters
  - TradeType (Buy/Sell)
  - Symbol name
  - Volume (units and lots)
  - Label
  - Stop Loss (pips and price)
  - Take Profit (pips and price)
- Actual position details after execution
  - Position ID
  - Entry Price
  - Volume (units and lots)
  - Stop Loss (price)
  - Take Profit (price)
  - **Expected loss at SL** (calculated from actual position)

**Example Output**:
```
═══════════════════════════════════════════════════════════════
[TRADE_EXEC] Calling CalculatePositionSize...
[TRADE_EXEC] Returned volume: 2000.00 units (0.0200 lots)
[TRADE_EXEC] ExecuteMarketOrder params:
[TRADE_EXEC]   TradeType=Buy
[TRADE_EXEC]   Symbol=EURUSD
[TRADE_EXEC]   Volume=2000.00 units (0.0200 lots)
[TRADE_EXEC]   Label=Jadecap-Pro
[TRADE_EXEC]   SL=20.00 pips (Price: 1.16760)
[TRADE_EXEC]   TP=33.10 pips (Price: 1.17291)
[TRADE_EXEC] ✅ POSITION OPENED:
[TRADE_EXEC]   Position ID: 5
[TRADE_EXEC]   Entry Price: 1.16960
[TRADE_EXEC]   Volume: 2000.00 units (0.0200 lots)
[TRADE_EXEC]   Stop Loss: 1.16760
[TRADE_EXEC]   Take Profit: 1.17291
[TRADE_EXEC]   Expected loss at SL: $4.00
[TRADE_EXEC] Trade executed: Buy 2000.00 units at 1.16960
═══════════════════════════════════════════════════════════════
```

---

## Build Status

✅ **Compilation Successful**
- 0 Warnings
- 0 Errors
- Build Time: 3.07 seconds

**Output Files**:
- `CCTTB\bin\Debug\net6.0\CCTTB.dll`
- `CCTTB\bin\Debug\net6.0\CCTTB.algo`
- `CCTTB.algo` (root)

---

## Next Steps

### 1. Re-run Sept 7-11 Backtest with Enhanced Logging

**Instructions**:
1. Open cTrader
2. Load the updated bot (`CCTTB.algo`)
3. Run backtest: Sept 7-11, 2025, EURUSD, $1,000 starting capital
4. Save the debug log to: `C:\Users\Administrator\Desktop\JadecapDebug_Enhanced_Sept7-11.log`

### 2. Analyze PID5 Trade in New Log

**What to Look For**:

The enhanced logging will reveal the exact position sizing calculation for **ALL 5 trades**, including the catastrophic PID5 loss. Look for:

#### Expected Pattern (Correct Sizing)
```
[RISK CALC] Equity=$1000.00 Balance=$1000.00
[RISK CALC] RiskPercent=0.4% → RiskAmount=$4.00
[RISK CALC] StopDistance (clamped)=20.00 pips
[RISK CALC FINAL] Units=2000.00 (0.0200 lots)
[RISK CALC FINAL] Expected loss at SL = $4.00
[TRADE_EXEC]   Volume: 2000.00 units (0.0200 lots)
[TRADE_EXEC]   Expected loss at SL: $4.00
```

#### Potential Issues to Identify

**Issue #1: Equity Explosion**
```
[RISK CALC] Equity=$216000.00 Balance=$1000.00  ← WRONG: Using inflated equity
[RISK CALC] RiskPercent=0.4% → RiskAmount=$864.00  ← 216x too high
[RISK CALC FINAL] Units=432000.00 (4.3200 lots)  ← 216x oversized
[RISK CALC FINAL] Expected loss at SL = $864.00  ← Matches actual -$866 loss!
```

**Issue #2: Wrong Risk Percent**
```
[RISK CALC] Equity=$1000.00 Balance=$1000.00
[RISK CALC] RiskPercent=86.4% → RiskAmount=$864.00  ← WRONG: RiskPercent broken
[RISK CALC FINAL] Units=432000.00 (4.3200 lots)
```

**Issue #3: Pip Value Miscalculation**
```
[RISK CALC] PipValuePerUnit=$0.02160000  ← WRONG: 216x too large
[RISK CALC] Denominator = 20.00 pips × $0.02160000 = $0.432000
[RISK CALC] RawUnits = $4.00 / $0.432000 = 9.26  ← Units too small, will hit VolumeMin clamp
[RISK CALC] Normalized: 9.26 → 1000.00
[RISK CALC] After VolumeMin clamp (1000): 1000.00  ← Forced to minimum, ignores risk calculation
```

**Issue #4: VolumeMin Clamp Forcing Oversized Position**
```
[RISK CALC] RawUnits = 2.00  ← Correct calculation
[RISK CALC] Normalized: 2.00 → 2.00
[RISK CALC] After VolumeMin clamp (432000): 432000.00  ← WRONG: VolumeMin is 216x too high!
[RISK CALC FINAL] Units=432000.00 (4.3200 lots)
```

**Issue #5: ExecuteMarketOrder Volume Override**
```
[TRADE_EXEC] Returned volume: 2000.00 units (0.0200 lots)  ← Correct from RiskManager
[TRADE_EXEC]   Volume=432000.00 units (4.3200 lots)  ← WRONG: Volume changed before ExecuteMarketOrder!
[TRADE_EXEC]   Expected loss at SL: $864.00  ← Matches actual -$866 loss
```

---

### 3. Search for Root Cause Pattern

Once you have the new log, search for these patterns:

#### Search #1: Find All PID5 Risk Calculations
```
grep -A 30 "RISK CALC START.*1.16960.*1.16760" JadecapDebug_Enhanced_Sept7-11.log
```

#### Search #2: Find All Position Opened Events
```
grep -A 10 "POSITION OPENED" JadecapDebug_Enhanced_Sept7-11.log
```

#### Search #3: Find Any Equity Anomalies
```
grep "Equity=" JadecapDebug_Enhanced_Sept7-11.log
```

#### Search #4: Find Any VolumeMin Clamp Events
```
grep "VolumeMin clamp" JadecapDebug_Enhanced_Sept7-11.log
```

#### Search #5: Find Any Volume Mismatches
```
grep -B 5 -A 5 "Returned volume.*Expected loss" JadecapDebug_Enhanced_Sept7-11.log
```

---

## Expected Outcomes

### If Position Sizing is Correct
- All 5 trades show consistent risk calculations
- PID5 shows: RiskAmount=$4.00, Units=2000, Expected loss=$4.00
- **This means the catastrophic loss occurred AFTER entry** (slippage, gap, trailing SL bug, etc.)

### If Position Sizing is Broken
- PID5 shows: RiskAmount=$864+ or Units=432000+
- **This confirms position sizing is the root cause**
- Focus on fixing the specific issue identified (equity, risk%, pip value, clamp, etc.)

---

## Logging Summary

### Total Lines Added: ~60 lines of debug logging

**RiskManager**: 35 lines
- Entry/exit logging
- Mode selection
- Capital tracking
- Risk calculation breakdown
- Pip value calculation with fallbacks
- Volume normalization and clamping
- Expected loss calculation

**TradeManager**: 25 lines
- Volume calculation tracking
- ExecuteMarketOrder parameter logging
- Position details after execution
- Expected loss verification

---

## Impact on Performance

**Minimal**: Debug logging uses `Console.WriteLine()` and `_robot.Print()` which are optimized for backtesting and live environments. Expected performance impact: <1ms per trade execution.

---

## How to Disable Debug Logging (After Diagnosis)

Once the PID5 issue is resolved, you can:

1. **Comment out all logging blocks** (search for `CRITICAL DEBUG LOGGING (Oct 23, 2025)`)
2. **Use conditional compilation**:
   ```csharp
   #if DEBUG_POSITION_SIZING
       Console.WriteLine($"[RISK CALC] ...");
   #endif
   ```
3. **Leave it enabled**: The logging is valuable for ongoing monitoring and won't impact performance

---

## Files to Provide for Analysis

After running the Sept 7-11 backtest with enhanced logging, provide:

1. **Full debug log**: `JadecapDebug_Enhanced_Sept7-11.log`
2. **cTrader backtest report**: Export from cTrader UI (shows actual P&L, volume, etc.)
3. **Bot parameters used**: Screenshot or text file of all parameter values

---

**Status**: ✅ **Debug logging successfully added and compiled**

**Next Action**: Run Sept 7-11 backtest with enhanced logging to capture PID5 position sizing details.

---

**Date**: October 23, 2025
**Purpose**: Diagnose PID5 catastrophic loss (-$866 on 20-pip SL)
**Expected Result**: Identify whether position sizing calculation is broken or if loss occurred post-entry
