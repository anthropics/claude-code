# Min Risk/Reward Parameter Fix

## ✅ FIXED: MinRiskReward Can Now Be Set Below 1.0

### What Was Wrong
The parameter had a hardcoded constraint:
```csharp
MinValue = 1   // Could not go below 1.0
```

This prevented you from setting `Min Risk/Reward` to values like 0.75 or 0.8, which caused it to turn red in cTrader.

### What I Changed
**File**: [JadecapStrategy.cs:723](JadecapStrategy.cs#L723)

**Before**:
```csharp
[Parameter("Min Risk/Reward", Group = "Risk", DefaultValue = 1.0, MinValue = 1, MaxValue = 10)]
```

**After**:
```csharp
[Parameter("Min Risk/Reward", Group = "Risk", DefaultValue = 1.0, MinValue = 0.5, MaxValue = 10)]
```

Now you can set it anywhere from **0.5 to 10.0**.

---

## 🚀 How to Use the Fix

### Step 1: Reload the Bot in cTrader
1. **Stop any running instances** of the bot
2. **Remove the bot** from all charts
3. **Close cTrader** completely
4. **Reopen cTrader**
5. **Add the bot** to a chart again

### Step 2: Set the New Parameter Value
In the bot parameters:
```
Min Risk/Reward:  0.75   ← Now works! No red color!
```

Recommended values:
- **0.75** - Allows TP targets 15+ pips away (with 20 pip SL)
- **0.8** - Allows TP targets 16+ pips away
- **1.0** - Requires TP targets 20+ pips away (old default)

### Step 3: Apply All Recommended Parameter Changes

While you're updating parameters, also change:

**Risk Group**:
```
Min Risk/Reward:           0.75   (was 1.0 - NOW WORKS!)
Risk Per Trade (%):        0.4    (was 0.5)
Daily Loss Limit (%):      6.0    (was 4.0)
```

**Stops Group**:
```
Min Stop Clamp (pips):     20.0   (keep as-is)
Stop Buffer OTE (pips):    15.0   (keep as-is)
Stop Buffer OB (pips):     10.0   (keep as-is)
Stop Buffer FVG (pips):    10.0   (keep as-is)
```

**Other**:
```
Enable Debug Logging:      true   (turn on)
```

---

## 📊 Why 0.75 Instead of 1.0?

### With MinRR = 1.0 (Old - TOO STRICT)
```
Entry: 1.17900
SL:    1.17700 (20 pips)
TP candidates:
  - 1.17915 (15 pips away) → RR=0.75 → ❌ REJECTED (below 1.0)
  - 1.17918 (18 pips away) → RR=0.90 → ❌ REJECTED (below 1.0)
  - 1.17925 (25 pips away) → RR=1.25 → ✅ ACCEPTED

Result: Many valid TP targets rejected → TP defaults to 0.00000
```

### With MinRR = 0.75 (New - BALANCED)
```
Entry: 1.17900
SL:    1.17700 (20 pips)
TP candidates:
  - 1.17915 (15 pips away) → RR=0.75 → ✅ ACCEPTED
  - 1.17918 (18 pips away) → RR=0.90 → ✅ ACCEPTED
  - 1.17925 (25 pips away) → RR=1.25 → ✅ ACCEPTED

Result: More valid TP targets accepted → Fewer TP=0 defaults
```

**Why 0.75 is safe**:
- Still requires TP to be at least 15 pips away (with 20 pip SL)
- Filters out very low-RR setups (less than 0.75:1)
- Allows valid SMC setups where TP is 15-20 pips away
- Better than defaulting to TP=0 → 1:1 fallback

---

## 🎯 Expected Impact

### Before Fix (MinRR=1.0, couldn't change it):
```
Trade 1: TP target 18 pips away → RR=0.9 → Rejected → TP=0 → Default to 1:1
Trade 2: TP target 16 pips away → RR=0.8 → Rejected → TP=0 → Default to 1:1
Trade 3: TP target 22 pips away → RR=1.1 → Accepted ✅
```
**Result**: 2/3 trades defaulted to TP=0 (low RR, poor performance)

### After Fix (MinRR=0.75):
```
Trade 1: TP target 18 pips away → RR=0.9 → Accepted ✅
Trade 2: TP target 16 pips away → RR=0.8 → Accepted ✅
Trade 3: TP target 22 pips away → RR=1.1 → Accepted ✅
```
**Result**: 3/3 trades get proper TP (better performance)

---

## ✅ Verification Checklist

After reloading the bot:

- [ ] Min Risk/Reward shows **0.5 to 10.0** range (not 1 to 10)
- [ ] Setting it to **0.75** does NOT turn red
- [ ] Setting it to **0.5** does NOT turn red
- [ ] Setting it to **0.4** DOES turn red (below minimum)
- [ ] Bot loads without errors

---

## 🆘 Troubleshooting

### If parameter still shows MinValue=1.0:
1. Make sure you closed cTrader completely before reopening
2. Check that the bot DLL was rebuilt (check timestamp on CCTTB.algo file)
3. Try deleting the bot from cTrader and re-importing it

### If bot shows error on load:
1. Check cTrader logs (Log → System Log)
2. Rebuild the bot: `dotnet build --configuration Debug`
3. Restart cTrader

### If you want to use a different MinRR range:
You can edit line 723 in JadecapStrategy.cs to any range you want:
- `MinValue = 0.3` (allows 0.3:1 RR - very aggressive)
- `MinValue = 0.5` (allows 0.5:1 RR - balanced)
- `MinValue = 0.75` (allows 0.75:1 RR - conservative)

---

## 📝 Summary

**Problem**: Could not set Min Risk/Reward below 1.0 in cTrader

**Solution**: Changed `MinValue = 1` to `MinValue = 0.5` in code

**Action Required**:
1. ✅ Code fixed and rebuilt (done!)
2. ⏳ Reload bot in cTrader (you need to do this)
3. ⏳ Set Min Risk/Reward to 0.75 (you need to do this)
4. ⏳ Run backtest with new settings (you need to do this)

**Expected Result**: Fewer trades with TP=0.00000, more trades with proper TP targets! 🎯
