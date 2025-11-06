# Killzone Fallback Fix

## Problem

The orchestrator preset system was blocking ~95% of valid trading signals due to Focus filter mismatches:

- Signals are labeled `"Jadecap-Pro"` or `"Jadecap-Re"`
- Presets have Focus filters like `"NYSweep"`, `"AsiaSweep"`, `"LondonSweep"`
- The `LabelContainsFocusFilter` checks if signal label contains the Focus keyword
- Since `"Jadecap-Pro"` doesn't contain `"NYSweep"`, signals were blocked
- Only the `"Default"` preset (with empty Focus) allowed signals through
- **Result**: Only 2-4 trades per month instead of expected 20+

## User Requirement

The user clarified that multiple presets exist focused on different killzones (NY, Asia, London). The bot should:

1. Check if signal matches any preset's Focus filter
2. **If no preset matches BUT we're currently in a killzone, allow the signal anyway**
3. Only block signals that fail Focus filters AND are outside all killzones

This ensures the bot can trade during killzones even when preset Focus keywords don't match signal labels.

## Solution

Modified [Orchestrator.cs:158-175](C:\Users\Administrator\Documents\cAlgo\Sources\Robots\CCTTB\CCTTB\Orchestration\Orchestrator.cs#L158-L175) to add killzone fallback logic:

```csharp
// Killzone fallback: If no preset matched BUT we're in a killzone, allow the signal anyway
if (!allowedByAnyPreset)
{
    var utcNow = _robot.Server.Time.ToUniversalTime();
    bool inKillzone = IsInKillzone(utcNow);

    if (inKillzone)
    {
        _robot.Print($"[ORCHESTRATOR] Killzone fallback: No preset matched, but in killzone → ALLOWING signal");
        allowedByAnyPreset = true;
        allowedBy = "Killzone_Fallback";
    }
    else
    {
        _robot.Print($"[ORCHESTRATOR] BLOCKED: No preset allows this signal and not in killzone");
        return; // Blocked by all active presets and not in killzone
    }
}
```

## How It Works

1. **First Pass**: Check if signal matches ANY active preset's Focus filter
   - If match found → Allow signal and tag with preset name

2. **Fallback Check** (only if no preset matched):
   - Check if current UTC time is within ANY active preset's killzone
   - Uses existing `IsInKillzone()` method which calls `OrchestratorExtensions.IsInAnyKillzone()`
   - If in killzone → Allow signal with `"Killzone_Fallback"` tag
   - If NOT in killzone → Block signal

3. **Result**: Signals are allowed during killzones regardless of Focus filter mismatch

## Expected Behavior Change

**Before**:
```
[ORCHESTRATOR] Preset 'NY': BLOCKED | Focus='NYSweep'
[ORCHESTRATOR] Preset 'Asia': BLOCKED | Focus='AsiaSweep'
[ORCHESTRATOR] BLOCKED: No preset allows this signal
→ Signal rejected (only ~5% get through via "Default" preset)
```

**After**:
```
[ORCHESTRATOR] Preset 'NY': BLOCKED | Focus='NYSweep'
[ORCHESTRATOR] Preset 'Asia': BLOCKED | Focus='AsiaSweep'
[ORCHESTRATOR] Killzone fallback: No preset matched, but in killzone → ALLOWING signal
[ORCHESTRATOR] Preset check: PASSED by 'Killzone_Fallback'
→ Signal accepted (no preset label appended)
```

## Testing Recommendations

1. **Monitor logs** for `"Killzone fallback"` messages to confirm fallback is activating
2. **Compare trade frequency** before/after fix (should increase from 2-4/month to 15-20/month)
3. **Verify preset matching still works** when Focus filters DO match signal labels
4. **Check outside killzones** - signals should still be blocked when not in any killzone

## Files Modified

- [Orchestration/Orchestrator.cs](C:\Users\Administrator\Documents\cAlgo\Sources\Robots\CCTTB\CCTTB\Orchestration\Orchestrator.cs) - Lines 158-175

## Related Files

- [Orchestration/OrchestratorExtensions.cs](C:\Users\Administrator\Documents\cAlgo\Sources\Robots\CCTTB\CCTTB\Orchestration\OrchestratorExtensions.cs) - Contains `IsInAnyKillzone()` method
- [Orchestration/LabelContainsFocusFilter.cs](C:\Users\Administrator\Documents\cAlgo\Sources\Robots\CCTTB\CCTTB\Orchestration\LabelContainsFocusFilter.cs) - Focus filter implementation
- [Orchestration/OrchestratorPreset.cs](C:\Users\Administrator\Documents\cAlgo\Sources\Robots\CCTTB\CCTTB\Orchestration\OrchestratorPreset.cs) - Preset definition with killzone settings

## Build Status

✅ Build succeeded with no errors or warnings
