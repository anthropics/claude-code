# Killzone Gate Fix - inKillzone=False Issue

## Problem

Your log shows:
```
killzoneGate=True inKillzone=False
Entry gated: not allowed or outside killzone
```

**Time**: 17:10 UTC (5:10 PM)
**Expected**: NY preset active (13:00-22:00 UTC) → `inKillzone=TRUE`
**Actual**: `inKillzone=FALSE` → Entry blocked

---

## Root Cause

You have **TWO killzone systems**:

### 1. Legacy Killzone Gate (Parameter-Based)
```
Enable Killzone Gate = TRUE (in your settings)
Uses: _config.KillZoneStart and _config.KillZoneEnd
```

### 2. Preset Killzone System (JSON-Based)
```
Uses: Orchestrator presets with KillzoneStartUtc/KillzoneEndUtc
Auto-switches based on active presets
```

**The conflict**:
```csharp
// Line 1641 in JadecapStrategy.cs
if (entryAllowed && (!_config.EnableKillzoneGate || inKillzone))
```

When `EnableKillzoneGate = TRUE`:
- Entry requires `inKillzone = TRUE`
- But preset orchestrator sets `inKillzone` at line 1415
- If orchestrator doesn't run properly, `inKillzone` stays `FALSE`
- Entry is BLOCKED ❌

---

## Solution 1: Disable Legacy Killzone Gate (RECOMMENDED)

Since you're using **preset-based killzones** (automatic session switching), you should **DISABLE** the legacy killzone gate.

**Steps**:
1. Open cTrader → Bot Settings
2. Find **"Enable Killzone Gate"** parameter
3. Set to **FALSE**
4. Save and restart bot

**Why**: When using presets, killzone check happens automatically via orchestrator. The legacy killzone gate is redundant and causes conflicts.

---

## Solution 2: Fix Orchestrator Check (CODE FIX)

The code should prioritize orchestrator killzone over legacy gate when presets are loaded.

**Current Code** (Line 1641):
```csharp
if (entryAllowed && (!_config.EnableKillzoneGate || inKillzone))
{
    // Entry logic...
}
else if (_config.EnableDebugLogging)
{
    _journal.Debug("Entry gated: not allowed or outside killzone");
}
```

**Fixed Code**:
```csharp
// When using orchestrator presets, ALWAYS use orchestrator's inKillzone
// Legacy EnableKillzoneGate is ignored when presets are active
bool killzoneCheck = _orc != null ? inKillzone : (!_config.EnableKillzoneGate || inKillzone);

if (entryAllowed && killzoneCheck)
{
    // Entry logic...
}
else if (_config.EnableDebugLogging)
{
    if (_orc != null)
        _journal.Debug($"Entry gated: inKillzone={inKillzone} (preset mode)");
    else
        _journal.Debug($"Entry gated: not allowed or outside killzone (legacy mode)");
}
```

**Why**: This ensures orchestrator presets OVERRIDE legacy killzone gate.

---

## Solution 3: Debug Orchestrator (WHY inKillzone=False?)

Your preset orchestrator should be returning `inKillzone=TRUE` at 17:10 UTC because NY preset (13:00-22:00) is active.

**Check Orchestrator Logs**:

Look for this log line (appears every 50 bars):
```
Preset KZ: 17:10 UTC | inKZ=??? | Active=??? | KZ=??:??-??:??
```

**Expected**:
```
Preset KZ: 17:10 UTC | inKZ=True | Active=NY_Internal_Mechanical | KZ=13:00-22:00
```

**If you see**:
```
Preset KZ: 17:10 UTC | inKZ=False | Active= | KZ=00:00-00:00
```

**Then**: Orchestrator is not loading presets correctly!

---

## Root Cause Analysis

### Why is inKillzone=False at 17:10 UTC?

**Possible Causes**:

1. **Orchestrator not initialized**
   ```csharp
   if (_orc != null)  // Is this TRUE?
   {
       inKillzone = _orc.IsInKillzone(utcNow);  // This should run
   }
   ```

2. **Presets not loaded**
   ```
   Check: Does "Presets" folder exist?
   Path: c:\Users\Administrator\Documents\cAlgo\Sources\Robots\CCTTB\CCTTB\bin\Debug\net6.0\Presets
   ```

3. **No active preset at 17:10 UTC**
   ```
   NY presets: 13:00-22:00 UTC
   17:10 UTC should be INSIDE
   But orchestrator might not be finding active preset
   ```

4. **Legacy killzone fallback**
   ```csharp
   else
   {
       // Falls back to legacy killzone
       inKillzone = IsWithinKillZone(sessionNow.TimeOfDay, _config.KillZoneStart, _config.KillZoneEnd);
   }
   ```
   If orchestrator is NULL or fails, it uses legacy killzone (00:00-24:00 hardcoded)

---

## Quick Fix (IMMEDIATE)

**Option A: Disable Killzone Gate** (5 seconds)
```
1. Bot Settings → "Enable Killzone Gate" → FALSE
2. Restart bot
3. Test backtest
```

**Result**: Entries will work regardless of killzone time (trading 24/7 until you fix orchestrator)

---

**Option B: Force inKillzone=TRUE** (1 minute code change)
```csharp
// Line 1415 - Force inKillzone=TRUE for testing
if (_orc != null)
{
    inKillzone = _orc.IsInKillzone(utcNow);

    // TEMPORARY FIX: Force TRUE if orchestrator fails
    if (!inKillzone)
    {
        _journal.Debug($"WARNING: Orchestrator returned inKillzone=FALSE at {utcNow:HH:mm} UTC. Forcing TRUE for testing.");
        inKillzone = true;  // Force TRUE
    }
}
```

**Result**: Entries will work even if orchestrator fails (temporary workaround)

---

## Permanent Fix (RECOMMENDED)

**Step 1**: Fix orchestrator priority (Code change above - Solution 2)

**Step 2**: Debug why orchestrator returns inKillzone=FALSE:

```csharp
// Add debug logging at line 1415
if (_orc != null)
{
    inKillzone = _orc.IsInKillzone(utcNow);

    // DEBUG: Log orchestrator state
    var activePresets = _orc.GetActivePresetNames();
    var kzInfo = _orc.GetKillzoneInfo();

    _journal.Debug($"[ORCHESTRATOR] Time={utcNow:HH:mm} UTC | inKZ={inKillzone} | Active={activePresets} | KZ={kzInfo.start:hh\\:mm}-{kzInfo.end:hh\\:mm}");

    // Check if no presets are active
    if (string.IsNullOrEmpty(activePresets))
    {
        _journal.Debug("WARNING: No active presets found! Check preset JSON files.");
    }
}
```

**Step 3**: Run backtest and check logs for orchestrator state

---

## Expected Log Output (After Fix)

**Before Fix**:
```
17:10 | EntryCheck: allowed=True killzoneGate=True inKillzone=False confirmed=MSS,OTE,IFVG
17:10 | Entry gated: not allowed or outside killzone
```

**After Fix** (Killzone Gate Disabled):
```
17:10 | EntryCheck: allowed=True killzoneGate=False inKillzone=False confirmed=MSS,OTE,IFVG
17:10 | [ORCHESTRATOR] Time=17:10 UTC | inKZ=False | Active= | KZ=00:00-00:00
17:10 | WARNING: No active presets found! Check preset JSON files.
17:10 | BuildSignal: mssDir=Bearish entryDir=Bearish
17:10 | ENTRY OTE: dir=Bearish entry=1.17400 stop=1.17450
```

**After Fix** (Orchestrator Working):
```
17:10 | EntryCheck: allowed=True killzoneGate=False inKillzone=True confirmed=MSS,OTE,IFVG
17:10 | [ORCHESTRATOR] Time=17:10 UTC | inKZ=True | Active=NY_Internal_Mechanical | KZ=13:00-22:00
17:10 | BuildSignal: mssDir=Bearish entryDir=Bearish
17:10 | ENTRY OTE: dir=Bearish entry=1.17400 stop=1.17450
```

---

## Summary

**Problem**: `inKillzone=False` at 17:10 UTC blocks entry

**Root Cause**:
- `Enable Killzone Gate = TRUE` (legacy mode)
- Orchestrator not returning `inKillzone=TRUE` properly
- Conflict between legacy gate and preset orchestrator

**Quick Fix**: Disable "Enable Killzone Gate" parameter (set to FALSE)

**Permanent Fix**:
1. Prioritize orchestrator killzone over legacy gate (code change)
2. Debug why orchestrator returns `inKillzone=FALSE` at 17:10 UTC
3. Check preset JSON files are loaded correctly

**Next Step**: Set "Enable Killzone Gate" to FALSE and run backtest again.

---

## Implementation

Would you like me to:
1. ✅ **Quick fix**: Add code to ignore killzone gate when orchestrator is active?
2. ✅ **Debug fix**: Add logging to show why orchestrator returns FALSE?
3. ✅ **Both**: Implement both fixes now?

Let me know and I'll implement the fix immediately!
