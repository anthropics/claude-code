# 🚀 BACKTEST QUICK START GUIDE

## Step 1: Open cTrader Automate

1. Launch **cTrader**
2. Click **Automate** tab (top menu)
3. Your bot should appear in the list: **CCTTB**

---

## Step 2: Configure Bot Parameters

### RECOMMENDED SETTINGS (Copy these exactly)

**Strategy Section**:
```
Enable Phase4o4 strict mode: false
```

**Profiles Section**:
```
Preset: Asia_Liquidity_Sweep (or any preset)
Policy Mode: AutoSwitching_Orchestrator
```

**Adaptive Learning Section** (MOST IMPORTANT):
```
Enable Adaptive Learning: true
Use Adaptive Scoring: true
Adaptive Confidence Threshold: 0.6
Use Adaptive Parameters: false
Adaptive Min Trades Required: 50
```

**SMT Correlation** (DISABLE for now):
```
Enable SMT: false
SMT Compare Symbol: (leave blank or "USDX")
SMT As Filter: false
```

**Risk Management**:
```
Risk Percent: 0.4
Min Risk Reward: 0.75
Min Stop Clamp Pips: 20
Daily Loss Limit: 6.0
```

**Debug Logging**:
```
Enable Debug Logging: true  ← IMPORTANT for seeing Phase logs
```

---

## Step 3: Run Backtest

1. Click **"Backtest"** button (play icon with clock)
2. **Set backtest parameters**:
   - **Symbol**: EURUSD
   - **Timeframe**: 5 Minutes (M5)
   - **Period**:
     - From: **September 18, 2025**
     - To: **October 1, 2025**
   - **Initial Deposit**: $10,000
   - **Commission**: Use broker defaults

3. Click **"Start"** button

---

## Step 4: Monitor Progress

### What You'll See

The backtest will run through ~2 weeks of data. Watch for:

**Console Output** (should show):
```
[PHASE 2] Market Regime Detection initialized (ADX period=14)
[ADAPTIVE LEARNING] System initialized
[REGIME CHANGE] Ranging → Trending | ADX=28.3
[ADAPTIVE FILTER] Sweep rejected: PDH | Reliability 0.45 < 0.60
[ADAPTIVE FILTER] OTE passed: Confidence 0.68 >= 0.60
[SMT FILTER] Entry ALLOWED - No divergence detected
[PHASE 4 RISK] Confidence=0.75 → Multiplier=1.00x
[STRUCTURE EXIT] Opposing MSS detected! Tightening SL
```

**Progress Bar**: Shows completion percentage

**Time**: Should take 30-60 seconds for 2 weeks of M5 data

---

## Step 5: Check Results

### After Backtest Completes

**Summary Tab** will show:
- Net Profit: $XXX
- Win Rate: XX%
- Total Trades: XX
- Sharpe Ratio: X.XX
- Max Drawdown: XX%

### Compare to Expected

**Early trades (1-50)** - Learning Phase:
- Trade count: ~10-15 trades
- Win rate: 40-50% (baseline with neutral scores)
- All confidence scores = 0.50 (neutral)

**Later trades (51+)** - Enhanced Phase:
- Trade count: ~5-8 trades (filtering active)
- Win rate: 55-70% (improved from learning)
- Varied confidence scores (0.4-0.8)
- Dynamic position sizing (0.5×, 1.0×, 1.5×)

---

## Step 6: Export Results

1. Click **"Export"** button
2. Save as: `CCTTB_Enhanced_EURUSD_M5_Sep18-Oct1.cset`
3. Location: `C:\Users\Administrator\Documents\cAlgo\Sources\Robots\CCTTB\CCTTB\backtests\`

---

## Step 7: Check Learning Data

After backtest, verify learning data was collected:

**Open folder**:
```
C:\Users\Administrator\Documents\cAlgo\Data\cBots\CCTTB\data\learning\
```

**Should see**:
- `history.json` (master learning database)
- `daily_20250918.json` through `daily_20251001.json` (daily records)

**Open `history.json`** and verify:
```json
{
  "OteStats": { "TotalTaps": 25 },      // Should be > 0 now!
  "MssStats": { "TotalMss": 45 },       // Should be > 0 now!
  "SweepStats": { "TotalSweeps": 38 }   // Should be > 0 now!
}
```

---

## Step 8: Check Log File

**Log location**:
```
C:\Users\Administrator\Documents\cAlgo\Data\cBots\CCTTB\data\logs\
```

**Find newest log**: `JadecapDebug_YYYYMMDD_HHMMSS.log`

**Search for key phrases**:
1. `[ADAPTIVE FILTER]` - Should see rejections and acceptances
2. `[REGIME CHANGE]` - Should see 5-10 regime changes
3. `[PHASE 4 RISK]` - Should see varying multipliers
4. `[STRUCTURE EXIT]` - Should see some early exits

---

## ⚠️ TROUBLESHOOTING

### "No trades executed"
**Cause**: Filters too strict or killzone settings wrong
**Fix**:
- Set `Use Adaptive Scoring = false` temporarily
- Check `Enable SMT = false`
- Verify killzone hours match your backtest time

### "Build errors" or "Bot won't load"
**Cause**: Bot not compiled properly
**Fix**:
```bash
cd "C:\Users\Administrator\Documents\cAlgo\Sources\Robots\CCTTB\CCTTB"
dotnet build --configuration Debug
```

### "Learning data not populating"
**Cause**: `EnableAdaptiveLearning = false`
**Fix**: Set `Enable Adaptive Learning = true` in bot parameters

### "All trades same size"
**Cause**: Confidence scores all neutral (0.5) or Phase 4 not working
**Fix**: Check logs for `[PHASE 4 RISK]` messages

---

## 📊 SUCCESS CRITERIA

Your backtest is successful if you see:

✅ **Trades executed**: 10-20 trades total
✅ **Win rate**: 50-70% range
✅ **Learning data**: `history.json` populated with OTE/MSS/Sweep stats
✅ **Adaptive filtering**: Logs show rejections/acceptances
✅ **Regime detection**: 5-10 regime changes logged
✅ **Dynamic risk**: Position sizes vary (check logs)
✅ **Structure exits**: Some trades exited early (check logs)

---

## 📋 NEXT STEPS AFTER BACKTEST

1. **Share results** with me:
   - Net profit, win rate, trade count
   - Log file path (I'll analyze it)
   - `history.json` contents

2. **I'll analyze**:
   - Which filters are working best
   - If thresholds need adjustment
   - Performance improvements vs baseline

3. **We'll optimize**:
   - Fine-tune `AdaptiveConfidenceThreshold` (0.5, 0.6, 0.7)
   - Adjust risk multipliers if needed
   - Enable SMT if you have DXY data

---

**Ready to run!** Just follow Steps 1-8 above. 🚀

**Estimated time**: 5 minutes to configure + 1 minute to run = 6 minutes total.
