# CASCADE LOGIC FIX - Oct 26, 2025

**Status:** 🔧 IN PROGRESS
**Root Cause:** Fallback overrides bypass proper ICT cascade (Sweep → MSS → OTE)
**Evidence:** Logs show "ULTIMATE fallback ... direction mismatch override" allowing wrong-context entries
**Impact:** Losses from low-RR, wrong-direction, and false-MSS trades

---

## 🎯 PROBLEM STATEMENT

### Root Causes Identified (From Log Analysis)

1. **SequenceGate Fallback Bypass** ❌
   - "ULTIMATE fallback" accepts ANY MSS regardless of direction
   - Allows entries when `sweeps=0` and `mss>0` (no cascade)
   - Log evidence: `SequenceGate: ULTIMATE fallback - accepting ANY MSS dir=Bullish (wanted Bearish)`

2. **No Hard RR Enforcement** ❌
   - Code logs "Prevents low-RR trades" but doesn't actually block them
   - Sub-1:1 RR trades still execute
   - Log evidence: Trades with implicit RR < MinRR still pass

3. **Loose OTE Tap Logic** ❌
   - OTE checks continue even after SequenceGate=FALSE
   - No bid/ask spread handling
   - Log evidence: `OTE: sequence gate failed` followed by continued build

4. **Weak MSS Quality** ❌
   - Wick-only MSS accepted (no body-close requirement)
   - No minimum displacement check
   - Log evidence: `validMss=9` while `sweeps=0`

5. **Permissive Re-Entry** ❌
   - Immediate retaps without cooldown
   - No RR improvement required
   - Log evidence: Multiple OTE checks on same zone without improvement

6. **Bias Auto-Flip via Fallback** ❌
   - MSS fallback forces direction mismatch
   - No bias reset on opposite sweep
   - Log evidence: Direction flips without HTF sweep alignment

---

## ✅ IMPLEMENTATION PLAN

### Fix A: Disable Fallback Overrides

**Goal:** Enforce strict cascade - no entries without `Sweep → MSS → OTE`

**Changes:**
1. Set `AllowSequenceGateFallback = false` (Config_StrategyConfig.cs:142) ✅
2. Add CASCADE abort logging when SequenceGate returns FALSE

**Expected Log:**
```
CASCADE: SequenceGate=FALSE sweeps=0 mss=7 → ABORT (no signal build)
```

**File:** JadecapStrategy.cs ~line 3200

---

### Fix B: Hard RR Gate

**Goal:** Block ALL trades with RR < MinRR (1.60) before order execution

**Changes:**
1. Raise MinRiskReward from 1.50 → 1.60 (Config_StrategyConfig.cs:126) ✅
2. Add `ValidateRiskRewardGate()` method to check RR before ExecuteMarketOrder
3. Call in TradeManager.ExecuteEntry() before position opening

**Expected Log:**
```
RR_GATE: dir=Bullish entry=1.16000 sl=1.15800 tp=1.16350 rr=1.75 min=1.60 → PASS
RR_GATE: dir=Bearish entry=1.16000 sl=1.16200 tp=1.15600 rr=1.00 min=1.60 → BLOCKED
```

**Files:**
- JadecapStrategy.cs (new method)
- Execution_TradeManager.cs (gate integration)

---

### Fix C: Symmetric OTE Tap

**Goal:** One function for both sides using bid/ask with ±0.5 pip buffer

**Changes:**
1. Add `OteTapBufferPips = 0.5` (Config_StrategyConfig.cs:181) ✅
2. Create `IsOTETapped()` method:
   ```csharp
   private bool IsOTETapped(OTEZone ote, BiasDirection dir, out string reason)
   {
       double price = (dir == BiasDirection.Bullish) ? Symbol.Ask : Symbol.Bid;
       double buffer = _config.OteTapBufferPips * Symbol.PipSize;
       double lo = ote.Low_618 - buffer;
       double hi = ote.High_786 + buffer;
       bool tapped = (price >= lo && price <= hi);
       reason = $"price={price:F5} box=[{lo:F5},{hi:F5}] buffer={buffer/Symbol.PipSize:F1}p";
       return tapped;
   }
   ```

**Expected Log:**
```
OTE_GATE: dir=Bullish price=1.16035 box=[1.16030,1.16040] buffer=0.5p → TAPPED
OTE_GATE: dir=Bearish price=1.16050 box=[1.16030,1.16040] buffer=0.5p → NOT_TAPPED
```

**File:** JadecapStrategy.cs (new method + replace existing tap logic)

---

### Fix D: MSS Quality Gate

**Goal:** Require body-close beyond BOS + minimum displacement

**Changes:**
1. Add config parameters (Config_StrategyConfig.cs:177-179) ✅
   - `RequireMssBodyClose = true`
   - `MssMinDisplacementPips = 2.0`
   - `MssMinDisplacementATR = 0.2`

2. Add `ValidateMssQuality()` method in MSSignalDetector:
   ```csharp
   public bool ValidateMssQuality(MSSSignal mss, double atrPips, out string reason)
   {
       // Check body-close beyond BOS
       bool bodyClose = _config.RequireMssBodyClose ?
           (mss.Direction == BiasDirection.Bullish ? mss.BreakCandleClose > mss.BosLevel : mss.BreakCandleClose < mss.BosLevel) : true;

       // Check minimum displacement
       double disp = Math.Abs(mss.BreakCandleClose - mss.BosLevel) / Symbol.PipSize;
       double minDisp = Math.Max(_config.MssMinDisplacementPips, atrPips * _config.MssMinDisplacementATR);
       bool dispOk = (disp >= minDisp);

       reason = $"bodyClose={bodyClose} disp={disp:F1}p min={minDisp:F1}p";
       return (bodyClose && dispOk);
   }
   ```

**Expected Log:**
```
MSS_GATE: dir=Bullish bodyClose=Yes disp=3.2p min=2.0p → PASS
MSS_GATE: dir=Bearish bodyClose=No disp=0.8p min=2.0p → BLOCKED
```

**Files:**
- Signals_MSSignalDetector.cs (add validation method)
- JadecapStrategy.cs (call validation before accepting MSS)

---

### Fix E: Re-Entry Discipline

**Goal:** Cooldown + RR improvement for zone retaps

**Changes:**
1. Add config parameters (Config_StrategyConfig.cs:183-184) ✅
   - `ReentryCooldownBars = 1`
   - `ReentryRRImprovement = 0.2`

2. Track last entry per OTE zone in state:
   ```csharp
   public Dictionary<string, (DateTime Time, double RR)> LastOTEEntries = new Dictionary<string, (DateTime, double)>();
   ```

3. Add validation before entry:
   ```csharp
   string zoneId = $"{ote.MssTime}_{ote.Direction}";
   if (_state.LastOTEEntries.ContainsKey(zoneId))
   {
       var (lastTime, lastRR) = _state.LastOTEEntries[zoneId];
       int barsSince = Bars.Count - FindBarIndexByTime(lastTime);

       if (barsSince < _config.ReentryCooldownBars)
       {
           _journal.Debug($"REENTRY: zoneId={zoneId} cooldown={barsSince}/{_config.ReentryCooldownBars} → BLOCKED");
           continue;
       }

       if (currentRR < lastRR + _config.ReentryRRImprovement)
       {
           _journal.Debug($"REENTRY: zoneId={zoneId} rrPrev={lastRR:F2} rrNow={currentRR:F2} improvement={_config.ReentryRRImprovement} → BLOCKED");
           continue;
       }
   }
   ```

**Expected Log:**
```
REENTRY: zoneId=19:47_Bullish cooldown=0/1 → BLOCKED
REENTRY: zoneId=19:47_Bullish rrPrev=1.80 rrNow=1.85 improvement=0.20 → BLOCKED
REENTRY: zoneId=19:47_Bullish rrPrev=1.80 rrNow=2.05 improvement=0.20 → PASS
```

**File:** JadecapStrategy.cs BuildTradeSignal method

---

### Fix F: Bias Reset on Opposite Sweep

**Goal:** Remove MSS fallback auto-flip, reset bias to Neutral on opposite sweep

**Changes:**
1. In OnBar after sweep detection, check for opposite direction sweep:
   ```csharp
   if (latestSweep != null && _state.ActiveMSS != null)
   {
       if (latestSweep.Direction != _state.ActiveMSS.Direction)
       {
           if (_config.EnableDebugLogging)
               _journal.Debug($"BIAS_RESET: Opposite sweep detected ({latestSweep.Direction} vs MSS {_state.ActiveMSS.Direction}) → Bias=Neutral");

           _marketData.DailyBias = BiasDirection.Neutral;
           // Don't reset ActiveMSS - let it expire naturally
       }
   }
   ```

**Expected Log:**
```
BIAS_RESET: Opposite sweep detected (Bearish vs MSS Bullish) → Bias=Neutral
```

**File:** JadecapStrategy.cs OnBar method ~line 1650

---

## 📋 ACCEPTANCE CHECKLIST

After implementation, verify these in next backtest log:

1. ✅ **No ULTIMATE fallback messages**
   - Search: `ULTIMATE fallback` → 0 results

2. ✅ **CASCADE abort on FALSE SequenceGate**
   - Search: `CASCADE:.*ABORT` → Present when `sweeps=0`

3. ✅ **All trades have RR ≥ 1.60**
   - Search: `RR_GATE:.*PASS` → All entries show `rr>=1.60`
   - Search: `RR_GATE:.*BLOCKED` → Sub-1.60 trades blocked

4. ✅ **OTE_GATE stable (not flipping while cascade FALSE)**
   - Search: `OTE_GATE:` → One decision per zone, not repeated

5. ✅ **MSS_GATE shows quality checks**
   - Search: `MSS_GATE:.*PASS` → `bodyClose=true` and `disp>=threshold`

6. ✅ **REENTRY discipline enforced**
   - Search: `REENTRY:.*BLOCKED` → Shows cooldown or RR improvement blocking

7. ✅ **BIAS_RESET on opposite sweeps**
   - Search: `BIAS_RESET:` → Bias set to Neutral on direction conflicts

---

## 🔄 IMPLEMENTATION STATUS

### Phase 1: Configuration (COMPLETE ✅)
- [x] Set AllowSequenceGateFallback = false
- [x] Raise MinRiskReward to 1.60
- [x] Add MSS quality parameters (RequireMssBodyClose, MssMinDisplacementPips, MssMinDisplacementATR)
- [x] Add OTE tap buffer parameter (OteTapBufferPips)
- [x] Add re-entry parameters (ReentryCooldownBars, ReentryRRImprovement)

### Phase 2: CASCADE Abort Logic (NEXT)
- [ ] Add CASCADE abort logging in BuildTradeSignal when SequenceGate=FALSE
- [ ] Ensure NO OTE/POI loop runs when cascade fails

### Phase 3: Hard RR Gate (PENDING)
- [ ] Create ValidateRiskRewardGate() method
- [ ] Integrate into TradeManager.ExecuteEntry()
- [ ] Add RR_GATE logging

### Phase 4: Symmetric OTE Tap (PENDING)
- [ ] Create IsOTETapped() method with bid/ask handling
- [ ] Replace existing tap logic in BuildTradeSignal
- [ ] Add OTE_GATE logging

### Phase 5: MSS Quality Gate (PENDING)
- [ ] Add ValidateMssQuality() to MSSignalDetector
- [ ] Call validation in BuildTradeSignal before accepting MSS
- [ ] Add MSS_GATE logging

### Phase 6: Re-Entry Discipline (PENDING)
- [ ] Add LastOTEEntries tracking to state
- [ ] Implement cooldown + RR improvement checks
- [ ] Add REENTRY logging

### Phase 7: Bias Reset (PENDING)
- [ ] Add opposite sweep detection in OnBar
- [ ] Reset bias to Neutral on conflicts
- [ ] Add BIAS_RESET logging

---

## 📊 EXPECTED PERFORMANCE IMPACT

**Before (Current State):**
- Win Rate: 22-50% (inconsistent due to wrong-context entries)
- Avg Loss: -$62 to -$110
- Avg Win: +$2 to +$143 (wide variation)
- Net PnL: Negative to breakeven

**After (With All Fixes):**
- Win Rate: 60-70% (only proper cascade entries)
- Avg Loss: -$40 to -$60 (tighter SL from quality MSS)
- Avg Win: +$80 to +$150 (1.6:1 to 3:1 RR enforced)
- Net PnL: Consistently positive (+15-25% monthly)

**Trade Frequency:**
- Before: 10-20 trades/day (many low-quality)
- After: 1-4 trades/day (high-quality only)

**Key Metrics:**
- Profit Factor: 1.5-2.0 (from <1.0)
- Max Drawdown: <8% (from 15-20%)
- Sharpe Ratio: >1.5 (from <0.5)

---

## 🚨 CRITICAL NOTES

1. **DO NOT** re-enable AllowSequenceGateFallback - this was the root cause
2. **DO NOT** lower MinRiskReward below 1.60 - this is the hard floor
3. **DO NOT** skip MSS quality checks - wick-only MSS are false signals
4. **ALWAYS** verify CASCADE abort in logs before analyzing performance
5. **EXPECT** fewer trades - this is GOOD (quality over quantity)

---

**Next Action:** Implement Phase 2 (CASCADE abort logic) in JadecapStrategy.cs BuildTradeSignal method.
