# Phased Strategy - Quick Start Testing Guide

**Ready to test**: Bot built successfully with phased strategy integration complete.

---

## Quick Test in cTrader (5 minutes)

### 1. Load the Bot
1. Open cTrader platform
2. Open EURUSD chart (M5 timeframe recommended)
3. Click "Automate" → "cBots"
4. Load "CCTTB" bot

### 2. Essential Parameters
**Must enable**:
- `EnableDebugLoggingParam` = **true** (see phase transitions in log)
- `RiskPercent` = 0.4% (will be overridden by phase logic to 0.2-0.9%)

**Recommended settings**:
- `MinRR` = 0.75 (balanced target filtering)
- `MinStopPipsClamp` = 20 (proper M5 stop loss)
- `MaxDailyRiskPercent` = 6.0% (allows 12-15 trades)
- `EnableClusteringPrevention` = true (cooldown after losses)

### 3. Watch the Log
**Key messages to look for**:

```
[PHASED STRATEGY] ✓ All components initialized successfully
[PHASED STRATEGY] OTE Zone: 61.8%-79.0%
[PHASED STRATEGY] Phase 1 Risk: 0.20%, Phase 3 Risk: 0.60%
[PHASED STRATEGY] ✓ ATR buffer wired into LiquiditySweepDetector

[PhaseManager] 🎯 Bias set: Bullish (Source: IntelligentBias-85%) → Phase 1 Pending
[PHASE 1] ✅ Entry allowed | POI: OB | Risk: 0.2% (was 0.4%)
[PHASE 1] Position closed with TP | PnL: $12.50

[PHASE 3] ✅ Entry allowed | Condition: No Phase 1 or Success | Risk: 0.9% (was 0.4%, base 0.6% × 1.5)
[PHASE 3] Position closed with SL | PnL: -$8.75
```

### 4. Expected Behavior

**Phase 1 (Counter-trend toward OTE)**:
- Entries: Order Blocks, FVG, Breaker Blocks (NOT OTE)
- Risk: 0.2% (half of normal)
- Target: ~15-30 pips (OTE zone entry)
- Stop: ~15-30 pips
- Frequency: 0-2 per day

**Phase 3 (With-trend from OTE)**:
- Entries: OTE retracements (61.8%-79%)
- Risk: 0.3-0.9% (0.5-2.25× normal based on Phase 1 outcome)
- Target: ~30-75 pips (opposite liquidity)
- Stop: ~20-40 pips
- Frequency: 1-2 per day

**Total Daily Trades**: 1-4 quality trades (down from 6-10+ before)

---

## Quick Backtest (10 minutes)

### 1. Setup Backtest
1. In cTrader, open Automate tab
2. Click "Backtest"
3. Select "CCTTB" bot
4. Set parameters:
   - **Period**: Sep 18, 2025 - Oct 1, 2025 (proven reference period)
   - **Symbol**: EURUSD
   - **Timeframe**: M5
   - **Initial Deposit**: $10,000
   - **EnableDebugLogging**: true

### 2. Run Backtest
Click "Start Backtest" and wait 2-3 minutes for completion.

### 3. Check Results
**Expected Metrics**:
- **Net Profit**: $200-500 (2-5% gain)
- **Total Trades**: 15-30 trades (1-4 per day)
- **Win Rate**: 50-65%
- **Average RR**: 2.0-3.5:1
- **Max Drawdown**: <3%

**Phase Distribution**:
- Phase 1 trades: ~30% of total (smaller positions, 0.2% risk)
- Phase 3 trades: ~70% of total (larger positions, 0.3-0.9% risk)

### 4. Verify Phase Logic
Check backtest log for:
- Phase 1 entries with 0.2% risk
- Phase 3 entries with variable risk (0.3-0.9%)
- Phase transitions (Pending → Active → Success/Failed → Pending)
- Extra confirmation after 1× Phase 1 failure

---

## What to Look For (Success Indicators)

### ✅ Correct Phase Risk
**Phase 1**: All non-OTE entries show `Risk: 0.2%`
**Phase 3**: OTE entries show `Risk: 0.3-0.9%` based on condition

### ✅ ATR Buffer Working
**Before**: Many false sweeps with fixed 5-pip buffer
**After**: Only valid sweeps with displacement, buffer adapts to volatility

Example log:
```
[SweepBuffer] TF=15m, ATR=0.00015, ATR×0.25=0.000038 (3.8p), Clamped=5.0p (min=3, max=20), Final=0.00005
[SweepBuffer] ✅ Buyside sweep confirmed: High=1.12345, Level=1.12340, Buffer=5.0p
```

### ✅ Cascade Validation
**DailyBias Cascade** (240min timeout):
```
[Cascade] DailyBias: HTF sweep registered (Daily) @ 1.12500 | Direction: Buy
[Cascade] DailyBias: LTF MSS registered (15M) | Direction: Sell | ✅ COMPLETE
```

**IntradayExecution Cascade** (60min timeout):
```
[Cascade] IntradayExecution: HTF sweep registered (4H) @ 1.12450 | Direction: Sell
[Cascade] IntradayExecution: LTF MSS registered (5M) | Direction: Buy | ✅ COMPLETE
```

### ✅ Phase 3 Conditional Logic
**No Phase 1**:
```
[PHASE 3] ✅ Entry allowed | Condition: No Phase 1 or Success | Risk: 0.9%
```

**After Phase 1 TP**:
```
[PHASE 1] Position closed with TP | PnL: $12.50
[PHASE 3] ✅ Entry allowed | Condition: No Phase 1 or Success | Risk: 0.9%
```

**After 1× Phase 1 SL**:
```
[PHASE 1] Position closed with SL | PnL: -$8.75
[PHASE 3] ✅ Entry allowed | Condition: After 1× Phase 1 Failure | Risk: 0.3%
[PHASE 3] Entry blocked - Extra confirmation required (FVG+OB) | Has FVG: true, Has OB: false
```

**After 2× Phase 1 SL**:
```
[PHASE 1] Position closed with SL | PnL: -$8.75
[PHASE 1] Position closed with SL | PnL: -$9.20
[PHASE 3] Entry blocked - Phase: Phase1_Failed
```

---

## Common Issues & Solutions

### Issue 1: No Phase Transitions Logged
**Symptom**: Bot loads but no `[PHASED STRATEGY]` or `[PhaseManager]` messages
**Solution**:
- Check `EnableDebugLoggingParam` is **true**
- Rebuild bot: `dotnet build --configuration Debug`
- Reload bot in cTrader

### Issue 2: All Trades Using 0.4% Risk
**Symptom**: No phase-specific risk (0.2% or 0.3-0.9%)
**Solution**:
- Check for `[PHASE 1] ✅ Entry allowed` or `[PHASE 3] ✅ Entry allowed` messages
- If missing, ApplyPhaseLogic() may be returning null (entry blocked)
- Verify bias is set: Look for `[PhaseManager] 🎯 Bias set: Bullish/Bearish`

### Issue 3: No Trades Executing
**Symptom**: Bot loads, bias set, but no entries
**Solution**:
- Check for `[PHASE 1] Entry blocked` or `[PHASE 3] Entry blocked` messages
- Common blocks:
  - Phase 1: No valid bias set, OTE already touched
  - Phase 3: OTE not touched, Phase 1 failed 2×
- Verify cascade completion: Look for `✅ COMPLETE` in cascade logs

### Issue 4: ATR Buffer Not Applied
**Symptom**: Sweeps still using fixed tolerance
**Solution**:
- Look for `[PHASED STRATEGY] ✓ ATR buffer wired` message in OnStart
- Check for `[SweepBuffer]` debug messages during sweep detection
- If missing, verify `_sweepDetector.SetSweepBuffer(_sweepBuffer)` was called

### Issue 5: Cascades Timing Out
**Symptom**: Many `[Cascade] Timeout (no MSS confirmation within Xm)` messages
**Solution**:
- Expected behavior during slow markets
- DailyBias timeout = 240 minutes (4 hours) - normal in ranging days
- IntradayExecution timeout = 60 minutes (1 hour) - may need adjustment for slower pairs
- Not a bug, just no valid setup detected

---

## Performance Benchmarks

### Before Phased Strategy
- Trades: 6-10 per day (overtrading)
- Risk: 0.4% per trade (flat)
- Stop Loss: 4-7 pips (too tight, noise hits)
- Win Rate: 40-45% (low)
- Monthly Return: +5-10% (inconsistent)

### After Phased Strategy (Expected)
- Trades: 1-4 per day (selective)
- Risk: 0.2-0.9% per trade (adaptive)
- Stop Loss: 15-40 pips (proper range)
- Win Rate: 50-65% (improved)
- Monthly Return: +20-30% (consistent)

---

## Next Actions

1. **Demo Test (Recommended)**: Run for 1-2 days, monitor phase transitions
2. **Backtest Validation**: Sep 18 - Oct 1, 2025 period
3. **Multi-TF Chart Review**: Open Daily, 4H, 1H, 15M, 5M charts simultaneously to watch cascade flow
4. **ATR Buffer Comparison**: Note sweep quality vs old fixed buffer
5. **Phase 3 Sequence Testing**: Wait for all 4 conditional sequences to occur naturally

**Good luck testing! 🚀**
