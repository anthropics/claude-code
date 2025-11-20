# Bot Parameters Cleanup - Intraday Trading Focus

## Summary

Removed **40+ unnecessary parameters** to simplify the bot for **intraday trading only** with **automated multi-preset system**.

---

## Parameters Removed

### 1. Weekly Trading Parameters (7 removed)

| Parameter | Reason |
|-----------|--------|
| `Use Weekly Profile Bias` | Not needed for intraday trading |
| `Enable Weekly Swing Mode` | Weekly analysis not required |
| `Require Weekly Sweep (PWH/PWL)` | Focus on intraday sweeps only |
| `Use Weekly Liquidity TP` | Intraday TP targets |
| `Enable Weekly Accumulation bias` | Intraday bias only |
| `Weekly Acc shift TF` | Not applicable |
| `Use Mon/Tue range for TP` | Not needed |
| `Include Weekly H/L zones` | PDH/PDL sufficient |
| `Allow Weekly sweeps` | Intraday sweeps only |
| `Key label color Weekly` | Visual cleanup |

**Hardcoded to**: `false`

---

### 2. PO3/Asia Session Parameters (7 removed)

| Parameter | Reason |
|-----------|--------|
| `Enable PO3 (Asia sweep gating)` | Replaced by multi-preset system |
| `Asia Start (HH:mm)` | Preset killzones handle this |
| `Asia End (HH:mm)` | Preset killzones handle this |
| `Require Asia sweep before entry` | Not needed - gates relaxed |
| `PO3 Lookback (bars)` | PO3 gate disabled |
| `Asia Range max ADR %` | Not used |
| `ADR Period (days)` | Not used |

**Hardcoded to**: `false` / default values

**Reason**: Multi-preset system with preset-based killzones replaces manual PO3 session logic.

---

### 3. Session-Specific MSS Parameters (13 removed)

| Parameter | Reason |
|-----------|--------|
| `Enable Session Overrides` | Multi-preset handles sessions |
| `Require Opposite-Side Sweep` | Gate relaxed (set to false) |
| `Opposite Sweep Lookback` | Not needed |
| `MSS Max Age (bars)` | Simplified |
| `London Start (HH:mm)` | Preset killzones handle this |
| `London End (HH:mm)` | Preset killzones handle this |
| `NY Start (HH:mm)` | Preset killzones handle this |
| `NY End (HH:mm)` | Preset killzones handle this |
| `Debounce Bars (London)` | Single debounce setting |
| `Debounce Bars (NY)` | Single debounce setting |
| `Require Retest (London)` | Gate relaxed |
| `Require Retest (NY)` | Gate relaxed |

**Hardcoded to**: `false` / default values

**Reason**: Multi-preset system handles session-specific behavior via preset files, not bot parameters.

---

### 4. Session Timezone Parameters (5 removed)

| Parameter | Reason |
|-----------|--------|
| `Session TZ offset vs server (hours)` | Presets use UTC times |
| `Auto-adjust session DST` | Not needed with UTC |
| `Session TimeZone Id (Windows)` | Not needed with UTC |
| `Session Time Zone Preset` | Hardcoded to UTC |
| `Kill Zone Start (Hours EST)` | Preset killzones handle this |
| `Kill Zone End (Hours EST)` | Preset killzones handle this |

**Hardcoded to**: `UTC` / `0.0` offset

**Reason**: All preset killzones are defined in UTC in JSON files. No timezone conversion needed.

---

### 5. SMT Parameters (5 removed)

| Parameter | Reason |
|-----------|--------|
| `Enable SMT divergence` | Not used for intraday |
| `SMT Compare Symbol` | Not used |
| `SMT TimeFrame` | Not used |
| `SMT as filter (block opposite)` | Not used |
| `SMT pivot (swings)` | Not used |

**Hardcoded to**: `false`

**Reason**: SMT (Smart Money Tools) divergence not used in intraday strategy.

---

### 6. Scalping Parameter (1 removed)

| Parameter | Reason |
|-----------|--------|
| `Enable Scalping Profile` | Not used |

**Hardcoded to**: `false`

**Reason**: Using mechanical intraday strategy, not scalping.

---

## Parameters KEPT (Essential for Intraday Trading)

### ✅ Core Entry Parameters
- `Enable Sequence Gate` = TRUE (validates sweep → MSS → entry)
- `Sequence Lookback (bars)` = 200
- `Allow Sequence Fallback` = TRUE
- `Require MSS to Enter` = TRUE
- `Enable Killzone Gate` = TRUE (preset-based)

### ✅ Intraday Parameters
- `Bias TF (Pro-Trend)` = Hour (or whatever HTF you use)
- `Enable Intraday Bias` = FALSE (MSS provides direction)

### ✅ Entry Detectors
- OTE parameters (Fibonacci retracements)
- Order Block parameters
- FVG parameters
- Breaker Block parameters

### ✅ Trade Management
- `Enable BreakEven` = TRUE
- `Enable Partial Close` = TRUE
- `Enable Trailing Stop` = TRUE
- BreakEven distance, partial close %, trailing parameters

### ✅ Risk Management
- Risk percentage
- ATR sanity check
- Margin check
- Min RR

### ✅ Debug
- `Enable Debug Logging` = TRUE/FALSE
- `Enable File Logging` = TRUE/FALSE

---

## Before vs After Comparison

### BEFORE (60+ parameters)
```
Strategy Group:
  - Kill Zone Start (Hours EST)
  - Kill Zone End (Hours EST)
  - Session TZ offset vs server (hours)
  - Auto-adjust session DST
  - Session TimeZone Id (Windows)
  - Session Time Zone Preset
  - ...

MSS Sessions Group:
  - London Start (HH:mm)
  - London End (HH:mm)
  - NY Start (HH:mm)
  - NY End (HH:mm)
  - Debounce Bars (London)
  - Debounce Bars (NY)
  - Require Retest (London)
  - Require Retest (NY)
  - ...

PO3 Group:
  - Enable PO3 (Asia sweep gating)
  - Asia Start (HH:mm)
  - Asia End (HH:mm)
  - Require Asia sweep before entry
  - PO3 Lookback (bars)
  - Asia Range max ADR %
  - ADR Period (days)

SMT Group:
  - Enable SMT divergence
  - SMT Compare Symbol
  - SMT TimeFrame
  - SMT as filter (block opposite)
  - SMT pivot (swings)

Weekly Group:
  - Enable Weekly Swing Mode
  - Require Weekly Sweep (PWH/PWL)
  - Use Weekly Liquidity TP
  - Enable Weekly Accumulation bias
  - Weekly Acc shift TF
  - Use Mon/Tue range for TP
  - ...

Scalping Group:
  - Enable Scalping Profile
```

---

### AFTER (Cleaned up - Focus on essentials)

```
Entry Group:
  - Enable Sequence Gate = TRUE ✅
  - Sequence Lookback (bars) = 200 ✅
  - Allow Sequence Fallback = TRUE ✅
  - Require MSS to Enter = TRUE ✅
  - Enable Killzone Gate = TRUE ✅
  - OTE parameters ✅
  - Order Block parameters ✅
  - FVG parameters ✅
  - Breaker parameters ✅

Bias Group:
  - Bias TF (Pro-Trend) = Hour ✅

Trade Management Group:
  - Enable BreakEven = TRUE ✅
  - Enable Partial Close = TRUE ✅
  - Enable Trailing Stop = TRUE ✅
  - BreakEven distance ✅
  - Partial close % ✅

Risk Group:
  - Risk % ✅
  - ATR sanity check ✅
  - Min RR ✅

Debug Group:
  - Enable Debug Logging ✅
  - Enable File Logging ✅
```

---

## How Multi-Preset System Replaces Removed Parameters

### Before (Manual Parameters):
```
Bot Parameters:
  - Asia Start = 00:00
  - Asia End = 09:00
  - London Start = 08:00
  - London End = 17:00
  - NY Start = 13:00
  - NY End = 22:00
  - Enable PO3 = TRUE
  - Require Asia sweep = TRUE
```

**Problem**: Manual configuration, no automatic switching

---

### After (Automated Presets):

**schedules.json**:
```json
[
  {
    "PresetName": "Asia_Internal_Mechanical",
    "StartUtc": "00:00",
    "EndUtc": "09:00"
  },
  {
    "PresetName": "London_Internal_Mechanical",
    "StartUtc": "08:00",
    "EndUtc": "17:00"
  },
  {
    "PresetName": "NY_Strict_Internal",
    "StartUtc": "13:00",
    "EndUtc": "22:00"
  }
]
```

**asia_internal_mechanical.json**:
```json
{
  "name": "Asia_Internal_Mechanical",
  "UseKillzone": true,
  "KillzoneStartUtc": "00:00",
  "KillzoneEndUtc": "09:00",
  "EntryGateMode": "MSSOnly"
}
```

**Result**: Automatic preset switching, no manual parameter changes needed! ✅

---

## Impact

### ✅ Benefits:

1. **Cleaner UI**: 40+ fewer parameters in cTrader settings
2. **Simpler Configuration**: Focus on essential trading parameters only
3. **Automated Session Handling**: Presets switch automatically by time
4. **No Manual Changes**: Set once, runs 24/7
5. **Easier Maintenance**: Less parameters to manage

### ✅ Trading Logic:

```
1. ✅ Multi-preset active (auto-switches by time)
2. ✅ Killzone check (preset-based, UTC times)
3. ✅ Sweep detected (intraday sweeps: PDH/PDL/EQH/EQL/CDH/CDL)
4. ✅ MSS confirmed (structure shift)
5. ✅ Sequence gate validates sweep → MSS → entry
6. ✅ Signal detector (OTE/OB/FVG/Breaker)
7. ✅ Price taps entry box
8. ✅ TRADE EXECUTED
```

**No weekly analysis, no PO3 gates, no SMT filters - clean intraday flow!**

---

## Configuration Files

### Essential Files (Keep):

1. **Presets/schedules.json** - When each preset is active
2. **Presets/presets/*.json** - Preset configurations with killzones
3. **JadecapStrategy.cs** - Main bot code

### Automation Scripts (Keep):

1. **Presets/1_UPDATE_PRESETS.bat** - Bulk update preset killzones
2. **Presets/2_VERIFY_SYSTEM.bat** - Verify preset configuration
3. **Presets/update_all_presets.ps1** - PowerShell automation
4. **Presets/verify_preset_system.ps1** - PowerShell verification

---

## Testing Checklist

### ✅ Step 1: Compile Bot
1. Open cTrader
2. Click **Build**
3. Should compile with **no errors** (all removed parameter references fixed)

### ✅ Step 2: Verify Parameters
Check that unnecessary groups are gone:
- ❌ No "MSS Sessions" group
- ❌ No "PO3" group
- ❌ No "SMT" group
- ❌ No "Weekly" group
- ❌ No "Scalping" group

### ✅ Step 3: Verify Essential Parameters
Check that essential parameters remain:
- ✅ "Entry" group (sequence gate, MSS, detectors)
- ✅ "Trade Management" group (BE, partial, trailing)
- ✅ "Risk" group (risk %, ATR, min RR)
- ✅ "Debug" group (logging)

### ✅ Step 4: Run Backtest
Load Sep-Nov 2023 data and verify trading works normally.

---

## Summary

**Removed**: 40+ parameters related to:
- Weekly trading
- PO3/Asia manual sessions
- Session-specific MSS overrides
- Manual timezone configuration
- SMT divergence
- Scalping profile

**Kept**: Essential intraday parameters:
- Entry gates (sequence, MSS)
- Signal detectors (OTE/OB/FVG/Breaker)
- Trade management (BE, partial, trailing)
- Risk management
- Debug logging

**Result**: Clean, focused bot for **intraday trading with automated multi-preset system**! 🎯

---

## Files Modified

- [JadecapStrategy.cs](JadecapStrategy.cs) - Removed 40+ parameters, hardcoded values for removed features

---

## Next Steps

1. ✅ **Compile** bot in cTrader (should compile successfully)
2. ✅ **Verify** parameter groups are cleaned up
3. ✅ **Run backtest** to ensure trading logic still works
4. ✅ **Update preset files** with killzones (run `1_UPDATE_PRESETS.bat` if not done)
5. ✅ **Start live/demo trading** with simplified configuration

Your bot is now clean and focused on intraday trading! 🚀
