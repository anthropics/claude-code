# DIAGNOSTIC BUILD COMPLETE - NEXT STEPS

## What I Did

**Added ultra-verbose startup diagnostic logging** to immediately show:
1. Whether `_cfg` is loading (or null)
2. Whether `_cfg.oteAdaptive` exists
3. Whether `_cfg.oteAdaptive.enabled` is true/false
4. ATR configuration values
5. Whether `_cfg.gates` exists
6. Gate configuration values

**Build Status**: ✅ Successful (0 Errors, 0 Warnings)
**Build Time**: Just now
**Build Location**: `CCTTB\bin\Debug\net6.0\CCTTB.algo`

---

## CRITICAL: How to Test This Build

### Step 1: Close cTrader Completely
1. Close all charts
2. File → Exit
3. **Check Task Manager** - kill any remaining cTrader.exe processes

### Step 2: Delete AlgoCache (IMPORTANT!)
```
Navigate to: C:\Users\Administrator\AppData\Roaming\cTrader\AlgoCache\
Delete ALL files in this folder
```

This forces cTrader to reload the .algo file from disk.

### Step 3: Restart cTrader and Load Bot
1. Open cTrader
2. Open chart (EURUSD M5 recommended)
3. Automate → CCTTB
4. Drag bot onto chart
5. **Set these parameters**:
   - **Enable Debug Logging**: TRUE
   - **Policy Mode**: AutoSwitching_Orchestrator (or any mode you want)
6. Click "Start"

### Step 4: CHECK THE LOG TAB IMMEDIATELY

**IMPORTANT**: The diagnostic messages appear in **cTrader's Log tab**, NOT just the debug log file.

Look for this block at the very top:
```
========================================
=== PHASE 1 DIAGNOSTIC CHECK ===
=== Bot Version: 2025-10-24-PHASE1 ===
=== Startup Time: [timestamp] ===
========================================
[PHASE1] _cfg null check: Loaded OK
[PHASE1] _cfg.oteAdaptive null check: Loaded OK
[PHASE1] _cfg.oteAdaptive.enabled: True
[PHASE1] ATR mode: atr
[PHASE1] ATR period: 14
[PHASE1] ATR multiplier: 0.18
[PHASE1] _cfg.gates null check: Loaded OK
[PHASE1] _cfg.gates.sequenceGate: True
[PHASE1] _cfg.gates.relaxAll: False
[PHASE1] _cfg.gates.mssOppLiqGate: strict
[PHASE1] orchestratorStamp: hs-session-kgz@1.0.0
========================================
```

### Step 5: Interpret the Results

**✅ If you see "Loaded OK" and enabled: True**:
- Phase 1 config is loading correctly
- The code should be working
- Check debug log for [OTE ADAPTIVE] messages (should appear every 20 bars)
- Check for varying tolerance: tol=1.2pips, tol=1.6pips (NOT always 1.00pips)

**❌ If you see "_cfg null check: NULL (PROBLEM!)"**:
- Config file is NOT loading at all
- Possible causes:
  1. Config file path is wrong
  2. Config file doesn't exist
  3. ConfigLoader.LoadActiveConfig() is throwing exception
  4. GetEffectiveConfigPath() returning bad path

**❌ If you see "_cfg.oteAdaptive null check: NULL (PROBLEM!)"**:
- Config file is loading, but doesn't have oteAdaptive block
- Check config/runtime/policy_universal.json or policy.json
- Verify oteAdaptive block exists in JSON

**❌ If you see "enabled: False"**:
- Config is loading, oteAdaptive exists, but it's disabled
- Change enabled: true in the config file

---

## What to Send Me

After you reload the bot with this new diagnostic build, send me:

**Option 1: Screenshot of cTrader Log Tab**
- Take screenshot showing the PHASE 1 DIAGNOSTIC CHECK block
- This tells me immediately what's wrong

**Option 2: Copy/Paste from Log Tab**
- Copy the entire PHASE 1 DIAGNOSTIC CHECK block
- Paste it in your message

**Option 3: Send New Debug Log**
- Wait 2-3 minutes
- Send the newest JadecapDebug_*.log file
- I'll check for the diagnostic messages

---

## Expected Scenarios

### Scenario A: Config Loading Successfully
```
[PHASE1] _cfg null check: Loaded OK
[PHASE1] _cfg.oteAdaptive null check: Loaded OK
[PHASE1] _cfg.oteAdaptive.enabled: True
[PHASE1] ATR mode: atr
```
**Result**: Phase 1 should work. Look for [OTE ADAPTIVE] messages in log and varying tolerance.

### Scenario B: Config File Not Loading
```
[PHASE1] _cfg null check: NULL (PROBLEM!)
```
**Cause**: ReloadConfigSafe() is catching exception and setting _cfg to default ActiveConfig.
**Solution**: Check ReloadConfigSafe exception message in log: `[ORCHESTRATOR] Config load failed: [error]`

### Scenario C: oteAdaptive Block Missing
```
[PHASE1] _cfg null check: Loaded OK
[PHASE1] _cfg.oteAdaptive null check: NULL (PROBLEM!)
```
**Cause**: config/runtime/policy_universal.json doesn't have oteAdaptive block.
**Solution**: Verify JSON file has the oteAdaptive section.

### Scenario D: oteAdaptive Disabled
```
[PHASE1] _cfg null check: Loaded OK
[PHASE1] _cfg.oteAdaptive null check: Loaded OK
[PHASE1] _cfg.oteAdaptive.enabled: False
```
**Cause**: oteAdaptive.enabled is set to false in config.
**Solution**: Change to true in JSON file.

---

## If Old Version STILL Loads

If you see **NO diagnostic messages at all** in the Log tab when bot starts:

**The old .algo file is STILL being used.**

**Nuclear Option: Manual File Replacement**

1. Stop bot
2. Copy new .algo file:
   ```
   From: C:\Users\Administrator\Documents\cAlgo\Sources\Robots\CCTTB\CCTTB\bin\Debug\net6.0\CCTTB.algo
   To: C:\Users\Administrator\Documents\cAlgo\Sources\Robots\CCTTB.algo
   ```
3. Overwrite existing file
4. Close cTrader completely
5. Delete AlgoCache folder
6. Restart cTrader
7. Reload bot

This ensures the exact .algo file from the build is loaded.

---

## Summary

**What Changed**: Added 30+ lines of Print() statements at startup showing Phase 1 config status.

**Where to Look**: cTrader Log tab (NOT just debug log file).

**What I Need**: Screenshot or copy/paste of the PHASE 1 DIAGNOSTIC CHECK block.

**This Will Tell Me**:
- Is config loading? (Yes/No)
- Is oteAdaptive block present? (Yes/No)
- Is oteAdaptive enabled? (True/False)
- What are the ATR settings?
- Are gates configured correctly?

**Time Required**: 5 minutes to reload bot and check Log tab.

---

**Created**: October 24, 2025 at 9:00 PM
**Build**: CCTTB v2025-10-24-PHASE1 with diagnostic logging
**Status**: Ready for testing - RELOAD BOT NOW
