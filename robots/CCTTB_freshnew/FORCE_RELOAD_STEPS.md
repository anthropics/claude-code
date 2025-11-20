# FORCE CTRADER TO RELOAD NEW BOT VERSION

## PROBLEM IDENTIFIED

**Build file timestamp**: October 24, 5:53 PM
**Latest log timestamp**: October 24, 8:21 PM (3 hours later)
**Result**: Bot still running OLD code (tol=1.00pips, SequenceGate=False, orchestrator=inactive)

**cTrader is caching the old .algo file and ignoring the new build.**

---

## SOLUTION: Force Reload (5 Steps)

### Step 1: Stop the Bot
1. Open cTrader
2. Right-click the bot on the chart
3. Click "Stop"
4. Wait 5 seconds

### Step 2: Remove the Bot from Chart
1. Right-click the bot
2. Click "Remove"
3. Confirm removal

### Step 3: Close cTrader COMPLETELY
1. File → Exit (or Alt+F4)
2. Wait for cTrader to fully close
3. **Check Task Manager** - make sure no cTrader.exe processes are running
4. If cTrader processes still running, end them

### Step 4: Delete cTrader Cache (IMPORTANT)
Navigate to:
```
C:\Users\Administrator\AppData\Roaming\cTrader\AlgoCache\
```

Delete all files in this folder (or the entire AlgoCache folder).

This forces cTrader to rebuild its cache from the .algo files.

### Step 5: Restart and Reload
1. Open cTrader
2. Open your chart (EURUSD M5)
3. Automate → CCTTB
4. Drag bot onto chart
5. **IMPORTANT**: Set these parameters:
   - **Enable Debug Logging**: TRUE
   - **Policy Mode**: AutoSwitching_Orchestrator
6. Click "Start"
7. Wait 2-5 minutes
8. Check the newest log file

---

## VERIFICATION: Check New Log For These Messages

### At Bot Startup (first 10 lines):
```
[ORCHESTRATOR] Config loaded from config/runtime/policy_universal.json
Mode: Auto-switching orchestrator
w_session=0.25 risk=1.00
[CONFIG GATES] Applied from config: SequenceGate=True, MSSGate=strict, RelaxAll=False
```

### Every 20 Bars:
```
[OTE ADAPTIVE] ATR=8.4pips × 0.18 = 1.51pips (bounds [0.9, 1.8])
```

### In OTE Checks:
```
OTE: NOT tapped | box=[1.16554,1.16569] chartMid=1.16516 tol=1.40pips
OTE: NOT tapped | box=[1.16554,1.16569] chartMid=1.16516 tol=1.60pips
OTE: TAPPED | box=[1.16554,1.16569] chartMid=1.16562 tol=1.50pips
```
**KEY**: tolerance should VARY (1.2, 1.4, 1.6, 1.8 pips), NOT always 1.00pips

### In Entry Checks:
```
SequenceGate=True
orchestrator=active
```

---

## IF STILL NOT WORKING AFTER RELOAD

### Check 1: Verify Code is Actually in JadecapStrategy.cs

Search for the Phase 1 code:
```bash
cd C:\Users\Administrator\Documents\cAlgo\Sources\Robots\CCTTB\CCTTB
grep -n "OTE ADAPTIVE" JadecapStrategy.cs
```

Should show line ~2518:
```csharp
_journal.Debug($"[OTE ADAPTIVE] ATR={atrPips:F2}pips × {atrConfig.multiplier:F2} = {calculatedTolPips:F2}pips (bounds [{minBound:F1}, {maxBound:F1}])");
```

### Check 2: Verify Utils_ConfigLoader.cs Has OteAdaptive Class

```bash
grep -n "class OteAdaptive" Utils_ConfigLoader.cs
```

Should find the class definition.

### Check 3: Rebuild from Scratch

```bash
cd C:\Users\Administrator\Documents\cAlgo\Sources\Robots\CCTTB\CCTTB
dotnet clean
dotnet build --configuration Debug
```

Should show:
```
Build succeeded.
    0 Warning(s)
    0 Error(s)
```

Then repeat Steps 1-5 above.

---

## ALTERNATIVE: Use Different Policy Mode for Testing

If AutoSwitching_Orchestrator isn't working, try:

**Policy Mode**: Manual_Intelligent_Universal

This uses `config/runtime/policy.json` instead of `policy_universal.json`.

But you should still see:
- Adaptive tolerance (varying, not 1.00pips)
- [CONFIG GATES] messages
- SequenceGate=True

---

## WHAT IF NOTHING WORKS?

If after following ALL steps above the bot still shows:
- tol=1.00pips (fixed)
- SequenceGate=False
- orchestrator=inactive
- NO diagnostic messages

Then the issue is **code not being compiled into the build**.

**Fallback Plan**: Add ultra-verbose logging to verify build:

```csharp
// Add to JadecapStrategy.cs, line 1200 (top of OnStart method):
Print("=== PHASE 1 CHECK: Bot version 2025-10-24-PHASE1 ===");
Print($"=== Config path: {GetEffectiveConfigPath()} ===");

if (_cfg == null)
    Print("=== WARNING: _cfg is NULL ===");
else
    Print($"=== _cfg loaded, orchestratorStamp: {_cfg.orchestratorStamp} ===");
```

These Print() statements will appear in cTrader's Log tab immediately when bot starts.

If you don't see "=== PHASE 1 CHECK: Bot version 2025-10-24-PHASE1 ===" in the Log tab, then the code definitely isn't in the build.

---

## SUMMARY

**Most likely cause**: cTrader cache is stale.

**Solution**: Delete AlgoCache folder, restart cTrader, reload bot.

**Expected result**: Diagnostic messages appear, tolerance varies, SequenceGate=True.

**Time required**: 5-10 minutes.

---

**Created**: October 24, 2025 at 8:30 PM
**Build timestamp**: October 24, 2025 at 5:53 PM
**Latest log**: October 24, 2025 at 8:21 PM (3 hours after build)
**Status**: New build exists, cTrader not loading it
