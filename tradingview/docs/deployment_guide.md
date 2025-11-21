# AI Trader's Shadow v2.1 - Deployment Guide

Step-by-step panduan untuk deploy Pine script v2.1 BALANCED dari development ke production.

---

## 📋 Pre-Deployment Checklist

### Requirements:
- [ ] TradingView account (Free/Pro/Pro+/Premium)
- [ ] Webhook endpoint aktif (http://103.189.234.15/webhook_v1)
- [ ] Trading bot backend siap menerima signals
- [ ] Bybit account dengan API keys configured
- [ ] Minimum $100 capital untuk testing
- [ ] Monitoring dashboard (optional tapi recommended)

### Recommended Before Starting:
- [ ] Backup existing v2.0 settings (if applicable)
- [ ] Document current performance metrics
- [ ] Set up paper trading environment
- [ ] Prepare testing checklist
- [ ] Notify team about deployment window

---

## 🚀 Phase 1: Development Environment Setup (Day 1)

### Step 1.1: Import Pine Script ke TradingView

1. **Login ke TradingView**
   ```
   URL: https://www.tradingview.com
   Akun: [your-account]
   ```

2. **Open Pine Editor**
   - Klik tombol "Pine Editor" di bagian bawah chart
   - Atau tekan `Alt + E` (Windows) / `Option + E` (Mac)

3. **Copy Pine Script**
   ```bash
   # Di terminal/VSCode:
   cat tradingview/indicators/ai_trader_shadow_v2.1_balanced.pine

   # Copy seluruh isi file (Ctrl+A, Ctrl+C)
   ```

4. **Paste ke Pine Editor**
   - Select all text in Pine Editor (if any)
   - Paste kode yang sudah dicopy (Ctrl+V)
   - Klik "Save" (Ctrl+S)
   - Beri nama: "AI Trader's Shadow v2.1 BALANCED"

5. **Compile Script**
   - Klik "Add to Chart" (atau F8)
   - Jika error: Check syntax, biasanya copy-paste issue
   - Jika success: Indicator muncul di chart ✅

**Expected Result**:
- ✅ Script compiled without errors
- ✅ Indicator visible on chart
- ✅ Filter status table visible (top right)
- ✅ EMA lines plotted

---

### Step 1.2: Configure Settings (BALANCED Mode)

1. **Open Indicator Settings**
   - Klik nama indicator di chart
   - Atau klik gear icon ⚙️ next to indicator name

2. **Set Mode to BALANCED**
   ```
   Trading Mode: BALANCED
   ```

3. **Verify BALANCED Parameters**
   ```
   ✓ Balanced Min Confidence: 0.65
   ✓ Balanced Cooldown: 10 bars
   ✓ Volume Multiplier (Balanced): 1.1
   ✓ ATR Multiplier (Balanced): 0.6
   ✓ Range Threshold Balanced: 0.02
   ```

4. **Enable All Filters**
   ```
   ✓ Enable Volume Filter: true
   ✓ Enable ATR Filter: true
   ✓ Enable Trend Filter: true
   ✓ Enable Regime Filter: true
   ```

5. **Configure Adaptive System**
   ```
   ✓ Enable Adaptive Threshold: true
   ✓ Consecutive Losses to Trigger: 5
   ✓ Adaptive Step Size: 0.03
   ✓ Max Adaptive Increase: 0.15
   ```

6. **Symbol Adjustments**
   ```
   ✓ Enable Symbol-Specific Adjustments: true
   ✓ ETH Confidence Multiplier: 0.85
   ✓ SOL Confidence Multiplier: 0.90
   ```

7. **Webhook Settings**
   ```
   ✓ Enable Webhook Alerts: true
   ✓ Webhook URL: http://103.189.234.15/webhook_v1
   ```

8. **Visual Settings**
   ```
   ✓ Show Buy/Sell Signals: true
   ✓ Show Confidence Labels: true
   ✓ Show Filter Status Table: true
   ```

9. **Click "OK"** to save settings

**Verification**:
```
Open Settings again and verify all values are correct
Screenshot settings for documentation
```

---

### Step 1.3: Create Alert

1. **Right-click on Chart**
   - Select "Add Alert" (or press Alt+A)

2. **Configure Alert Condition**
   ```
   Condition: AI Trader's Shadow v2.1 BALANCED
   ```

3. **Set Alert Options**
   ```
   Alert name: AI Trader v2.1 - [SYMBOL] [TIMEFRAME]

   Example: "AI Trader v2.1 - BTCUSDT 5m"
   ```

4. **Trigger Settings**
   ```
   Frequency: Once Per Bar Close ← IMPORTANT!
   Expiration: Open-ended
   ```

   **⚠️ WARNING**:
   - NEVER use "Once Per Bar" (fires on every tick)
   - Always use "Once Per Bar Close" (fires only when candle closes)

5. **Notifications**
   ```
   ✓ Webhook URL: http://103.189.234.15/webhook_v1
   ☐ Send email: false (unless you want email notifications)
   ☐ Show popup: false
   ☐ Play sound: false
   ☐ Send push notification: false (unless using mobile)
   ```

6. **Alert Message** (CRITICAL)
   ```
   Message: {{strategy.order.alert_message}}
   ```

   **⚠️ IMPORTANT**:
   - Use EXACTLY this format
   - Don't add any text before/after
   - This will use the JSON message from Pine script

7. **Click "Create"**

**Verification**:
```
1. Check Alert panel (clock icon, bottom right)
2. Should see: "AI Trader v2.1 - BTCUSDT 5m" (green = active)
3. Click on alert → verify settings
```

---

### Step 1.4: Test Alert Delivery

1. **Trigger Manual Alert** (for testing)

   Option A: Wait for real signal (may take hours)

   Option B: Temporarily lower confidence threshold
   ```
   Settings → Balanced Min Confidence: 0.65 → 0.40
   Wait 5-10 minutes for signal
   (Don't forget to change back to 0.65 after test!)
   ```

2. **Check Webhook Receipt**
   ```bash
   # On your backend server:
   tail -f /var/log/webhook.log

   # Should see:
   {
     "action": "BUY",
     "symbol": "BTCUSDT",
     "price": 36543.50,
     "confidence": 0.72,
     "atr": 125.30,
     "mode": "BALANCED",
     "timestamp": "1699900800000",
     "token": "sniper-bybit-production-2024"
   }
   ```

3. **Verify Alert in TradingView**
   ```
   Alert panel → Click alert name → "View all alerts"
   Should see list of fired alerts with timestamps
   ```

**If Webhook Not Working**:
```
Common issues:
1. Wrong URL (check http:// not https://)
2. Firewall blocking (check server port 80)
3. Alert message wrong (must be {{strategy.order.alert_message}})
4. Alert not created properly (delete and recreate)
5. TradingView alert limit reached (delete old alerts)
```

---

## 📊 Phase 2: Paper Trading (Days 2-5)

### Step 2.1: Setup Paper Trading Environment

1. **Bybit Paper Trading**
   ```
   URL: https://testnet.bybit.com
   Login with demo account
   Get $100,000 demo USDT
   ```

2. **Configure Backend to Use Testnet**
   ```python
   # In your webhook handler:
   USE_TESTNET = True

   exchange = ccxt.bybit({
       'apiKey': TESTNET_API_KEY,
       'secret': TESTNET_API_SECRET,
       'enableRateLimit': True,
       'options': {
           'defaultType': 'linear',
       }
   })

   if USE_TESTNET:
       exchange.set_sandbox_mode(True)
   ```

3. **Set Small Position Size** (for realistic testing)
   ```python
   # Simulate $1000 capital:
   POSITION_SIZE_PERCENT = 0.02  # 2% per trade
   MAX_POSITION_USDT = 1000 * 0.02  # $20 per trade
   ```

---

### Step 2.2: Day 1-2 Monitoring

**What to Track**:

1. **Signal Count**
   ```
   Hour      | Signals | Notes
   ----------|---------|------------------
   00:00-06:00 | 0     | Low volume (expected)
   06:00-12:00 | 2     | Asia session
   12:00-18:00 | 3     | Europe session
   18:00-00:00 | 4     | US session (most active)
   ----------|---------|------------------
   TOTAL      | 9     | Target: 5-10 ✓
   ```

2. **Filter Effectiveness**
   ```
   Filter     | Passed | Blocked | Block Rate
   -----------|--------|---------|------------
   Volume     | 7      | 2       | 22%
   ATR        | 8      | 1       | 11%
   Trend      | 6      | 3       | 33%
   Regime     | 9      | 0       | 0%
   -----------|--------|---------|------------
   All Filters| 5      | 4       | 44%
   ```

3. **Signal Quality**
   ```
   Signal | Time  | Price  | Conf | Result | PnL    | Notes
   -------|-------|--------|------|--------|--------|------------------
   BUY    | 08:23 | 36450  | 68%  | WIN    | +1.8%  | Clean breakout
   SELL   | 10:15 | 36720  | 71%  | WIN    | +2.1%  | Perfect resistance
   BUY    | 14:05 | 36580  | 65%  | LOSS   | -1.5%  | False breakout
   BUY    | 16:42 | 36810  | 73%  | WIN    | +1.9%  | Strong momentum
   SELL   | 19:30 | 37010  | 69%  | WIN    | +2.3%  | Overbought RSI
   -------|-------|--------|------|--------|--------|------------------
   TOTALS | -     | -      | 69%  | 4W-1L  | +6.6%  | Win rate: 80% ✓
   ```

**End of Day 1-2 Analysis**:
```
✅ Signal count: 9 (within target 5-10)
✅ Win rate: 80% (above target 60%)
✅ Avg confidence: 69% (above threshold 65%)
⚠️ Trend filter blocking 33% (may need adjustment)

Decision: Continue monitoring for Days 3-4
```

---

### Step 2.3: Day 3-4 Optimization

Based on Day 1-2 data, adjust parameters:

**If Signal Count Too Low (<3/day)**:
```
Settings adjustments:
- Min Confidence: 0.65 → 0.62
- Volume Multiplier: 1.1 → 1.0
- Cooldown: 10 → 8 bars
```

**If Signal Count Too High (>15/day)**:
```
Settings adjustments:
- Min Confidence: 0.65 → 0.68
- Cooldown: 10 → 12 bars
- Enable all filters: ✓
```

**If Win Rate Too Low (<55%)**:
```
Settings adjustments:
- Min Confidence: 0.65 → 0.70
- Trend Filter: Enable ✓
- Regime Filter: Enable ✓
- Consider switching to CONSERVATIVE mode
```

**Track Adjusted Performance**:
```
Day 1-2 (original settings):
- Signals: 9+8 = 17
- Win rate: 80%+75% = 77.5% avg
- PnL: +6.6%+5.2% = +11.8%

Day 3-4 (after adjustment):
- Signals: 11+10 = 21
- Win rate: 71%+68% = 69.5% avg
- PnL: +8.1%+7.4% = +15.5%

Conclusion: Adjustments improved signal count without hurting quality ✓
```

---

### Step 2.4: Day 5 - Final Paper Trading Evaluation

**Success Criteria** (must meet at least 4/6):

| Criteria | Target | Actual | Status |
|----------|--------|--------|--------|
| Signals/day avg | 5-10 | 8.7 | ✅ |
| Win rate | >60% | 72% | ✅ |
| Profit factor | >1.3 | 1.85 | ✅ |
| Max drawdown | <15% | 8.2% | ✅ |
| Avg trade duration | 2-6h | 3.5h | ✅ |
| Webhook reliability | >95% | 98% | ✅ |

**If ALL criteria met**: ✅ Proceed to Phase 3 (Live Trading Pilot)

**If <4 criteria met**: ⚠️ Extend paper trading for another 3-5 days

---

## 💰 Phase 3: Live Trading Pilot (Days 6-12)

### Step 3.1: Prepare for Live Trading

1. **Risk Assessment**
   ```
   Total capital: $1,000
   Risk per trade: 2% = $20
   Max concurrent positions: 2
   Max daily loss limit: 5% = $50

   Stop Loss: 1.5% (based on ATR)
   Take Profit: 2.5% (R:R = 1:1.67)
   ```

2. **Configure Backend for Live**
   ```python
   # Switch from testnet to mainnet
   USE_TESTNET = False

   # Use production API keys
   API_KEY = os.getenv('BYBIT_PROD_API_KEY')
   API_SECRET = os.getenv('BYBIT_PROD_API_SECRET')

   # Verify keys are correct
   exchange.load_markets()
   balance = exchange.fetch_balance()
   print(f"USDT Balance: ${balance['USDT']['free']}")
   ```

3. **Safety Checks**
   ```python
   # Add max position checks
   def validate_trade(signal):
       # Check 1: Don't trade if loss limit hit
       if daily_loss >= MAX_DAILY_LOSS:
           return False, "Daily loss limit reached"

       # Check 2: Don't exceed max positions
       if len(open_positions) >= MAX_POSITIONS:
           return False, "Max positions reached"

       # Check 3: Verify confidence
       if signal['confidence'] < MIN_CONFIDENCE:
           return False, "Confidence too low"

       # Check 4: Check balance
       if balance < POSITION_SIZE * 2:
           return False, "Insufficient balance"

       return True, "OK"
   ```

4. **Enable Monitoring**
   ```python
   # Log all trades
   import logging
   logging.basicConfig(
       filename='live_trading.log',
       level=logging.INFO,
       format='%(asctime)s - %(levelname)s - %(message)s'
   )

   # Send Telegram notifications (optional)
   import telegram
   bot = telegram.Bot(token=TELEGRAM_BOT_TOKEN)

   def notify(message):
       bot.send_message(chat_id=TELEGRAM_CHAT_ID, text=message)
       logging.info(message)
   ```

---

### Step 3.2: Days 6-8 - Conservative Start (10% Capital)

**Configuration**:
```
Live capital allocation: $100 (10% of $1000)
Position size: $100 * 2% = $2 per trade
Max positions: 1
```

**Daily Checklist**:
```
Morning (before market):
☐ Check bot status (running?)
☐ Verify webhook connectivity
☐ Review overnight positions
☐ Check Bybit API status

During market:
☐ Monitor signals in real-time (first 3 days)
☐ Verify trade execution (price, size, SL/TP)
☐ Check for any errors in logs

Evening (after market):
☐ Calculate daily PnL
☐ Update performance tracker
☐ Review trades (what went well/wrong)
☐ Adjust parameters if needed
```

**Day 6-8 Results Example**:
```
Day 6: +$0.18 (1 win, 0 loss, 2 signals total)
Day 7: -$0.04 (1 win, 1 loss, 2 signals)
Day 8: +$0.22 (2 wins, 0 loss, 3 signals)
-------
Total: +$0.36 (+0.36% on $100, or +3.6% annualized)
Win rate: 4/5 = 80%

Decision: ✅ Performance good, proceed to increase allocation
```

---

### Step 3.3: Days 9-12 - Scale Up (25% Capital)

**Configuration**:
```
Live capital allocation: $250 (25% of $1000)
Position size: $250 * 2% = $5 per trade
Max positions: 2
```

**Monitor for**:
- Slippage (price difference between signal and execution)
- Fill rate (% of orders successfully filled)
- Latency (time from signal to order)

**Day 9-12 Results Example**:
```
Day 9:  +$0.95 (2 wins, 1 loss, 4 signals)
Day 10: +$1.20 (3 wins, 0 loss, 4 signals)
Day 11: -$0.45 (1 win, 2 loss, 3 signals)
Day 12: +$0.80 (2 wins, 1 loss, 4 signals)
-------
Total: +$2.50 (+1.0% on $250)
Cumulative (Day 6-12): +$2.86

Win rate (Day 6-12): 11/16 = 69% ✅
Profit factor: 1.92 ✅
Max drawdown: 3.2% ✅

Decision: ✅ Ready for full capital deployment
```

---

## 🎯 Phase 4: Full Production (Day 13+)

### Step 4.1: Full Capital Deployment

**Configuration**:
```
Live capital allocation: $1,000 (100%)
Position size: $1,000 * 2% = $20 per trade
Max positions: 3 (diversify across symbols)
Max daily risk: $50 (5% of capital)
```

**Multi-Symbol Strategy**:
```
Symbol   | Allocation | Mode        | Timeframe
---------|------------|-------------|----------
BTC/USDT | 40% ($400) | BALANCED    | 5m
ETH/USDT | 35% ($350) | BALANCED    | 5m
SOL/USDT | 25% ($250) | AGGRESSIVE  | 5m
```

**Setup 3 Alerts** (one per symbol):
```
Alert 1: AI Trader v2.1 - BTCUSDT 5m
Alert 2: AI Trader v2.1 - ETHUSDT 5m
Alert 3: AI Trader v2.1 - SOLUSDT 5m
```

---

### Step 4.2: Ongoing Monitoring & Optimization

**Weekly Review** (every Monday):
```
Metrics to track:
- Total trades: [count]
- Win rate: [%]
- Total PnL: [$]
- ROI: [%]
- Max drawdown: [%]
- Sharpe ratio: [calculated]
- Best performing symbol: [BTC/ETH/SOL]
- Best performing time: [hour range]
```

**Monthly Optimization** (first Monday of month):
```
Analysis:
1. Which mode performed best? (CONSERVATIVE/BALANCED/AGGRESSIVE)
2. Which symbols had highest win rate?
3. Which timeframes were most profitable?
4. Were there any losing streaks? (check adaptive system)
5. Did any filters block good signals?

Actions:
1. Adjust mode for each symbol if needed
2. Fine-tune confidence thresholds (±0.03)
3. Optimize position sizes based on volatility
4. Update stop-loss/take-profit levels
5. Consider adding new symbols or timeframes
```

---

## 📈 Performance Targets

### Week 1 (Days 1-7):
```
Target: Break even or small profit
Actual: _______
Status: [✅/⚠️/❌]
```

### Week 2 (Days 8-14):
```
Target: +2-5% ROI
Actual: _______
Status: [✅/⚠️/❌]
```

### Month 1:
```
Target: +8-15% ROI, >60% win rate
Actual: _______
Status: [✅/⚠️/❌]
```

### Quarter 1 (3 months):
```
Target: +25-50% ROI, >65% win rate, Sharpe >2.0
Actual: _______
Status: [✅/⚠️/❌]
```

---

## 🚨 Emergency Procedures

### If Daily Loss Limit Hit (-5%):
```
1. Stop all trading immediately
2. Close all open positions
3. Disable alerts in TradingView
4. Review all trades from today
5. Identify what went wrong:
   - Market conditions changed?
   - Parameters wrong?
   - Execution issues?
6. Don't resume until root cause identified
7. Consider reducing position size by 50%
```

### If Max Drawdown Hit (-15%):
```
1. Pause trading for 24-48 hours
2. Review last 2 weeks of trades
3. Check if mode is appropriate for current market
4. Consider switching to CONSERVATIVE mode
5. Reduce position size to 1% per trade
6. Consult with team before resuming
```

### If Webhook Fails:
```
1. Check server logs: tail -f /var/log/webhook.log
2. Test webhook manually: curl -X POST http://103.189.234.15/webhook_v1
3. Verify TradingView alert is active
4. Check alert message format
5. Restart webhook service if needed
6. Set up backup webhook (secondary server)
```

### If Unusual Market Volatility (e.g., >10% BTC move in 1 hour):
```
1. Temporarily disable alerts (pause trading)
2. Close risky open positions
3. Wait for volatility to normalize (check ATR)
4. Increase confidence threshold temporarily (+0.10)
5. Resume when ATR < 2x average
```

---

## ✅ Post-Deployment Checklist

### Daily (First Month):
- [ ] Check bot status (running?)
- [ ] Review overnight positions
- [ ] Monitor signals and execution
- [ ] Update performance tracker
- [ ] Check for errors in logs

### Weekly:
- [ ] Calculate weekly metrics
- [ ] Review best/worst trades
- [ ] Optimize parameters if needed
- [ ] Backup trading data
- [ ] Update documentation

### Monthly:
- [ ] Full performance analysis
- [ ] Compare vs targets
- [ ] Optimize mode/symbol allocation
- [ ] Review and update risk parameters
- [ ] Plan next month strategy

---

## 📞 Support

If you encounter issues:

1. **Check logs first**
   ```bash
   tail -f /var/log/webhook.log
   tail -f live_trading.log
   ```

2. **Common issues & solutions**
   - See "Troubleshooting" section in main README.md

3. **Contact support**
   - Provide: logs, screenshots, signal history
   - Include: symbol, timeframe, mode, parameters

---

## 🎓 Conclusion

Deployment complete! 🎉

**Next Steps**:
1. Monitor daily for first week
2. Optimize parameters based on performance
3. Scale up capital gradually (10% → 25% → 50% → 100%)
4. Consider Phase 2: AI PPO integration (future)

**Remember**:
- Start small, scale gradually
- Track all metrics diligently
- Adjust based on data, not emotions
- Risk management is key

Good luck trading! 📈🚀

---

**Document Version**: 1.0
**Last Updated**: 2024-11-13
**Next Review**: 2024-11-20
