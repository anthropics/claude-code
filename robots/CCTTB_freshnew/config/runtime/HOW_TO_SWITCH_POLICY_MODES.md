# 🔄 HOW TO SWITCH BETWEEN POLICY MODES

## 🎯 THE SIMPLE SOLUTION

Your bot already has a parameter called **"Orchestrator Config Path"** in cTrader!

You DON'T need to modify C# code or rebuild. Just change the parameter value.

---

## 📝 STEP-BY-STEP INSTRUCTIONS

### Method 1: Use cTrader Parameter (EASIEST)

**In cTrader Automate:**

1. Click on your bot instance
2. Find parameter: **"Orchestrator Config Path"** (Group: "Profiles")
3. Change the value:

**For Auto-Switching Mode (RECOMMENDED):**
```
config/policy_universal.json
```

**For Manual Single Preset Mode:**
```
config/active.json
```
OR
```
config/runtime/policy.json
```

4. Click "Apply" or "Restart" bot
5. Done! ✅

---

### Method 2: Create Symlink (ADVANCED)

Create a symbolic link so `config/active.json` points to whichever policy you want:

**Windows PowerShell (Run as Administrator):**

**For Auto-Switching:**
```powershell
cd "C:\Users\Administrator\Documents\cAlgo\Sources\Robots\CCTTB\CCTTB\config"
Remove-Item active.json -ErrorAction SilentlyContinue
New-Item -ItemType SymbolicLink -Path "active.json" -Target "runtime\policy_universal.json"
```

**For Manual Mode:**
```powershell
cd "C:\Users\Administrator\Documents\cAlgo\Sources\Robots\CCTTB\CCTTB\config"
Remove-Item active.json -ErrorAction SilentlyContinue
New-Item -ItemType SymbolicLink -Path "active.json" -Target "runtime\policy.json"
```

Then keep ConfigPath parameter as `config/active.json` and just change the symlink target when you want to switch.

---

## 🎨 AVAILABLE CONFIGURATIONS

### Option A: policy_universal.json (Auto-Switching) ⭐ RECOMMENDED

**What it does:**
- Bot detects market state every 20 bars (ADX, ATR)
- Auto-switches between presets:
  - Trending → Perfect_Sequence_Hunter
  - Ranging → Intelligent_Universal
  - Volatile → phase4o4_strict_ENHANCED
  - Quiet → Intelligent_Universal

**Best for:**
- Unknown future days
- Varying market conditions
- Set-and-forget operation

**Expected:**
- 8-15 trades/day
- Adapts automatically
- Fixes weekly vs monthly gap

**ConfigPath value:**
```
config/runtime/policy_universal.json
```

---

### Option B: policy.json (Manual Mode)

**What it does:**
- Uses single configuration
- You choose preset manually via "Preset" parameter in cTrader
- No auto-switching

**Best for:**
- Testing specific presets
- Controlled backtesting
- When you want to lock one strategy

**Expected:**
- Varies by preset chosen
- Consistent behavior
- Manual control

**ConfigPath value:**
```
config/runtime/policy.json
```

**Then choose preset:**
- In cTrader, find "Preset" parameter (Group: "Profiles")
- Select from dropdown:
  - `Intelligent_Universal` (general purpose)
  - `Perfect_Sequence_Hunter` (conservative, high quality)
  - `Learning_Adaptive` (continuous learning)
  - `phase4o4_strict_ENHANCED` (strict rules + intelligence)

---

## 🔍 HOW TO VERIFY IT'S WORKING

### After Changing ConfigPath Parameter:

**Check logs for:**

**If using policy_universal.json (auto-switching):**
```
✓ "orchestrator=active"
✓ "state=TRENDING/RANGING/VOLATILE/QUIET"
✓ "activePreset=Perfect_Sequence_Hunter" (or other, changes every 20 bars)
✓ "Preset switched: RANGING → TRENDING, activating Perfect_Sequence_Hunter"
```

**If using policy.json (manual):**
```
✓ "orchestrator=inactive"
✓ "Manual preset mode"
✓ "Active preset: Intelligent_Universal" (or whichever you chose)
✓ "Using policy.json configuration"
```

---

## 🎯 WHICH MODE SHOULD YOU USE?

### Use **policy_universal.json** if:
- ✅ You want bot to adapt automatically
- ✅ You trade different market conditions
- ✅ You want to fix weekly vs monthly performance gap
- ✅ You don't want to manually switch presets
- ✅ **RECOMMENDED for most users**

### Use **policy.json** if:
- ✅ You're backtesting specific date ranges
- ✅ You want to test one preset thoroughly
- ✅ You prefer manual control
- ✅ You're comparing preset performance

---

## 📊 COMPARISON TABLE

| Feature | policy_universal.json | policy.json |
|---------|----------------------|-------------|
| **Preset Switching** | Automatic (every 20 bars) | Manual (you choose) |
| **Orchestrator** | Active | Inactive |
| **Market Adaptation** | Real-time (ADX, ATR) | Fixed strategy |
| **Best For** | All conditions | Single condition |
| **Setup Difficulty** | Easier (set once) | Requires preset selection |
| **Trades/Day** | 8-15 | Varies by preset |
| **Works on Unknown Days** | ✅ Yes | ⚠️ Depends on preset |

---

## ⚡ QUICK REFERENCE

**Current Parameter Name in cTrader:**
```
"Orchestrator Config Path"
Group: "Profiles"
Default: "config/active.json"
```

**To Use Auto-Switching (RECOMMENDED):**
```
Change to: config/runtime/policy_universal.json
```

**To Use Manual Mode:**
```
Change to: config/runtime/policy.json
THEN choose preset from "Preset" dropdown parameter
```

---

## 🔧 TROUBLESHOOTING

### Problem: Changed ConfigPath but bot still using old config

**Solution:**
1. Stop bot completely
2. Change ConfigPath parameter
3. Click "Apply"
4. Start bot fresh
5. Check logs for "Loading config from: [path]"

---

### Problem: Can't find "Orchestrator Config Path" parameter

**Solution:**
Look for these parameter names (might vary by bot version):
- "Orchestrator Config Path"
- "Config Path"
- "Active Config Path"
- Group: Usually "Profiles" or "Configuration"

If still not found, use Method 2 (symlink) instead.

---

### Problem: Bot crashes after changing path

**Solution:**
1. Verify file exists at the path you specified
2. Check path uses forward slashes: `config/runtime/policy_universal.json`
3. Verify JSON file is valid (no syntax errors)
4. Check cTrader console for error message

---

## 📁 FILE LOCATIONS

All policy files are in:
```
C:\Users\Administrator\Documents\cAlgo\Sources\Robots\CCTTB\CCTTB\config\runtime\
```

Available files:
- ✅ `policy_universal.json` - Auto-switching orchestrator
- ✅ `policy.json` - Manual single preset
- ✅ `active.json` - Default (can be symlink to either)

---

## 🎉 RECOMMENDED SETUP

**For Production Trading (Real Money):**
```
ConfigPath: config/runtime/policy_universal.json
EnableDebugLogging: TRUE (first week, then FALSE)
```

**For Backtesting:**
```
ConfigPath: config/runtime/policy.json
Preset: [Choose specific preset to test]
EnableDebugLogging: TRUE
```

---

**That's it! No code changes needed. Just change the parameter value! 🚀**
