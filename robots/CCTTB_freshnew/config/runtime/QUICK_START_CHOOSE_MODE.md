# ⚡ QUICK START - CHOOSE YOUR MODE

## 🎯 THE SIMPLE ANSWER

**You already have the parameter!** It's called:

```
"Orchestrator Config Path"
```

Found in cTrader Parameters → Group: "Profiles"

---

## 🚀 TWO MODES AVAILABLE

### Mode 1: Auto-Switching (RECOMMENDED) ⭐

**Set parameter to:**
```
config/runtime/policy_universal.json
```

**What happens:**
- Bot detects market state every 20 bars
- Auto-switches presets:
  - Trending → Perfect_Sequence_Hunter
  - Ranging → Intelligent_Universal
  - Volatile → phase4o4_strict_ENHANCED

**Result:**
- ✅ Works on any day (Sep 7-12 AND Sep 21-25)
- ✅ Adapts automatically
- ✅ 8-15 trades/day

---

### Mode 2: Manual Single Preset

**Set parameter to:**
```
config/runtime/policy.json
```

**Then choose preset from "Preset" dropdown:**
- `Intelligent_Universal` (all-around)
- `Perfect_Sequence_Hunter` (conservative)
- `Learning_Adaptive` (learns)
- `phase4o4_strict_ENHANCED` (strict)

**Result:**
- ✅ One strategy
- ✅ Manual control
- ✅ Good for testing

---

## 📸 VISUAL GUIDE

### Step 1: Find the Parameter

```
cTrader → Bot Instance → Parameters
↓
Look for: "Orchestrator Config Path"
Group: "Profiles"
Current value: "config/active.json"
```

### Step 2: Change the Value

**For Auto-Switching:**
```
OLD: config/active.json
NEW: config/runtime/policy_universal.json
```

**For Manual Mode:**
```
OLD: config/active.json
NEW: config/runtime/policy.json
```

### Step 3: Apply & Restart

```
Click "Apply" → Restart Bot → Done! ✅
```

---

## 🔍 VERIFY IT WORKED

### Check Logs:

**Auto-Switching Mode:**
```
✓ "orchestrator=active"
✓ "state=RANGING" (or TRENDING/VOLATILE/QUIET)
✓ "activePreset=Intelligent_Universal"
```

**Manual Mode:**
```
✓ "orchestrator=inactive"
✓ "Manual preset mode"
✓ "Active preset: [name you chose]"
```

---

## ⚡ ULTRA-QUICK VERSION

**Want auto-switching? (RECOMMENDED)**
1. Find parameter "Orchestrator Config Path"
2. Change to: `config/runtime/policy_universal.json`
3. Restart bot
4. Done!

**Want manual control?**
1. Change "Orchestrator Config Path" to: `config/runtime/policy.json`
2. Choose "Preset" from dropdown
3. Restart bot
4. Done!

---

## 🎯 WHICH ONE SHOULD YOU USE?

### Use Auto-Switching (policy_universal.json) if:
- You want to fix the weekly vs monthly performance gap ✅
- You want bot to adapt to changing conditions ✅
- You want set-and-forget operation ✅
- **95% of users should use this**

### Use Manual (policy.json) if:
- You're backtesting specific presets
- You're comparing performance
- You want full manual control

---

## 📞 NEED HELP?

See full guide: [HOW_TO_SWITCH_POLICY_MODES.md](HOW_TO_SWITCH_POLICY_MODES.md)

---

**That's it! Just change the parameter value. No code changes needed! 🚀**
