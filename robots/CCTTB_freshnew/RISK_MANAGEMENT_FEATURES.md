# Advanced Risk Management Features

## Summary

Added **7 advanced risk management features** to protect your account and improve trading performance WITHOUT blocking valid entries.

---

## Features Added

### 1. Circuit Breaker (Daily Loss Limit)

**What it does**: Automatically stops trading for the rest of the day if daily loss exceeds a percentage threshold.

**Parameters**:
```
Enable Circuit Breaker = TRUE
Daily Loss Limit % = 3.0% (default)
```

**How it works**:
```
Daily PnL = Current Balance - Starting Balance (at midnight)
If Daily PnL <= -3.0%:
  ⚠️ Trading disabled until next day
  Positions still managed (BE, partial, trailing)
```

**Example**:
```
Starting Balance: $10,000
Daily Loss Limit: 3% = $300
Current Balance: $9,680 (loss of $320)
✅ Circuit breaker ACTIVATED
❌ No new entries until tomorrow
✅ Open positions still managed
```

---

### 2. Max Daily Trades Limit

**What it does**: Limits number of trades per day to prevent overtrading.

**Parameters**:
```
Max Daily Trades = 6 (default)
```

**How it works**:
```
Daily Trade Count resets at midnight
Each position opened increments counter
If Daily Trade Count >= 6:
  ❌ No new entries today
  ✅ Open positions still managed
```

**Example**:
```
Trades executed today: 6
Status: ✅ Daily limit reached
Action: No new entries until tomorrow
```

---

### 3. Max Time-In-Trade Management

**What it does**: Automatically closes positions that have been held too long (prevents "dead trades").

**Parameters**:
```
Max Time In Trade (hours) = 8.0 (default)
```

**How it works**:
```
Entry Time: 01:30 UTC
Current Time: 09:45 UTC
Time Held: 8.25 hours
✅ Position closed automatically
Reason: Exceeded 8-hour time limit
```

**Example**:
```
[09:45] ⏱️ Closing position due to time limit: EURUSD_12345 (held 8.2h)
Trade closed at market price
```

---

### 4. Trade Clustering Prevention (Cooldown After Losses)

**What it does**: Pauses trading after consecutive losses to prevent emotional/revenge trading.

**Parameters**:
```
Enable Trade Clustering Prevention = TRUE
Cooldown After Losses = 2 (default)
Cooldown Duration (hours) = 4.0 (default)
```

**How it works**:
```
Trade 1: Loss (-$50)
Trade 2: Loss (-$60)
Consecutive Losses: 2
✅ Cooldown activated for 4 hours
❌ No new entries until 4 hours pass
✅ Open positions still managed

Next Trade: Win (+$80)
Consecutive Losses: 0 (reset)
```

**Example**:
```
[10:30] Trade closed: Loss -$50
[11:00] Trade closed: Loss -$60
[11:00] ⏸️ Trading cooldown activated after 2 consecutive losses
[11:00] Cooldown until: 15:00 UTC
[15:00] Cooldown expired, trading resumed
```

---

### 5. Performance Tracking by Detector

**What it does**: Tracks win/loss statistics for each signal detector (OTE, OB, FVG, Breaker).

**How it works**:
```
Position Label: "Jadecap-Pro OTE"
Detector: OTE
Result: Win (+$80)

Tracking:
  OTE Wins: 5
  OTE Losses: 2
  OTE Total: 7
  OTE Win Rate: 71%
```

**Benefits**:
- Identify which detectors perform best
- Optimize preset Focus settings
- Disable underperforming detectors

**Example Stats**:
```
Detector Performance (Today):
  OTE: 5W/2L (71% win rate)
  OrderBlock: 3W/4L (43% win rate)
  FVG: 2W/1L (67% win rate)
  Breaker: 1W/3L (25% win rate)

Best Detector: OTE (71%)
```

---

### 6. Performance HUD (Chart Display)

**What it does**: Displays real-time performance metrics on chart when debug logging is enabled.

**Requirements**:
```
Enable Debug Logging = TRUE
```

**HUD Display**:
```
┌────────────────────────────────────────────────────────────┐
│ 📊 Today: 5W/2L | PnL: +2.3% | Trades: 7/6 | Best: OTE 71% │
└────────────────────────────────────────────────────────────┘
```

**HUD Fields**:
- **Today**: Win/Loss count
- **PnL**: Daily profit/loss percentage
- **Trades**: Trades executed / Max daily trades
- **Best**: Best performing detector + win rate

---

### 7. Max Concurrent Positions (Already Existed)

**What it does**: Limits number of open positions at the same time.

**Parameters**:
```
Max Concurrent Positions = 3 (default)
```

**How it works**:
```
Open Positions: 3
Status: ❌ At capacity
Action: No new entries until a position closes
```

---

## How Risk Gates Work

### Gate Validation Flow

```
┌───────────────────────────────────────────────────────────┐
│  1. Circuit Breaker Check                                 │
│     ✅ Daily loss < 3%? → PASS                            │
│     ❌ Daily loss >= 3%? → BLOCK (until tomorrow)         │
└───────────────────────────────────────────────────────────┘
                          ↓
┌───────────────────────────────────────────────────────────┐
│  2. Max Daily Trades Check                                │
│     ✅ Trades < 6? → PASS                                 │
│     ❌ Trades >= 6? → BLOCK (until tomorrow)              │
└───────────────────────────────────────────────────────────┘
                          ↓
┌───────────────────────────────────────────────────────────┐
│  3. Max Concurrent Positions Check                        │
│     ✅ Positions < 3? → PASS                              │
│     ❌ Positions >= 3? → BLOCK (until position closes)    │
└───────────────────────────────────────────────────────────┘
                          ↓
┌───────────────────────────────────────────────────────────┐
│  4. Clustering Prevention Check                           │
│     ✅ Not in cooldown? → PASS                            │
│     ❌ In cooldown? → BLOCK (until cooldown expires)      │
└───────────────────────────────────────────────────────────┘
                          ↓
┌───────────────────────────────────────────────────────────┐
│  5. ALL GATES PASSED                                      │
│     ✅ Proceed to signal generation                       │
│     ✅ Execute entry if signal valid                      │
└───────────────────────────────────────────────────────────┘
```

---

## Integration with Trading Logic

### Risk Gates Run BEFORE Signal Generation

```csharp
protected override void OnBar()
{
    // ══════════════════════════════════════════════════════════════════
    // RISK MANAGEMENT GATES - Check BEFORE any trading logic
    // ══════════════════════════════════════════════════════════════════

    // 1. Check risk management gates (circuit breaker, daily limits, cooldown)
    bool riskGatesPass = CheckRiskManagementGates();

    // 2. Manage time-in-trade for existing positions
    ManageTimeInTrade();

    // 3. Draw performance HUD (if debug enabled)
    DrawPerformanceHUD();

    // 4. If risk gates block trading, skip signal generation
    if (!riskGatesPass)
    {
        // Still manage open positions even if new entries are blocked
        _tradeManager?.ManageOpenPositions(Symbol);
        return; // Skip signal generation
    }

    // ══════════════════════════════════════════════════════════════════
    // NORMAL TRADING LOGIC (only runs if risk gates pass)
    // ══════════════════════════════════════════════════════════════════

    // ... Sweep detection
    // ... MSS detection
    // ... Signal building
    // ... Entry execution
}
```

**Key Points**:
- ✅ Risk gates run **BEFORE** signal generation (efficient)
- ✅ Open positions still managed even when blocked
- ✅ Risk gates **DO NOT** interfere with sequence gate or other trading gates
- ✅ Risk gates **DO NOT** block each other (independent checks)

---

## Risk Gates vs Trading Gates

### Trading Gates (Validate Entry Logic)
```
✅ Sequence Gate: Validates sweep → MSS → entry
✅ MSS Gate: Ensures structure shift exists
✅ Killzone Gate: Validates trading hours
```

**Purpose**: Ensure entry follows correct trading logic

---

### Risk Gates (Protect Account)
```
✅ Circuit Breaker: Protects from daily loss
✅ Max Daily Trades: Prevents overtrading
✅ Max Concurrent: Limits exposure
✅ Cooldown: Prevents revenge trading
```

**Purpose**: Protect account from excessive risk

---

### No Conflicts

```
Trading Gates: Answer "Is this a VALID entry setup?"
Risk Gates: Answer "Is it SAFE to trade right now?"

Both run independently:
  ✅ Trading gates validate entry logic
  ✅ Risk gates protect account safety
  ❌ No circular dependencies
  ❌ No blocking each other
```

---

## Position Tracking (Automatic)

### Event Subscriptions

The bot automatically tracks positions using cTrader events:

```csharp
// In OnStart():
Positions.Opened += OnPositionOpenedEvent;
Positions.Closed += OnPositionClosed;
```

### When Position Opens

```csharp
private void OnPositionOpenedEvent(PositionOpenedEventArgs args)
{
    // Extract detector from label: "Jadecap-Pro OTE" → "OTE"
    string detectorLabel = ExtractDetectorLabel(args.Position.Label);

    // Track entry time, increment counters, initialize performance tracking
    OnPositionOpened(args.Position, detectorLabel);
}
```

**Tracked Data**:
- Entry time (for time-in-trade management)
- Daily trade count (for max daily trades)
- Detector label (for performance tracking)

---

### When Position Closes

```csharp
private void OnPositionClosed(PositionClosedEventArgs args)
{
    // Track win/loss
    if (args.Position.NetProfit < 0)
    {
        ConsecutiveLosses++;

        // Activate cooldown if threshold reached
        if (ConsecutiveLosses >= 2)
            CooldownUntil = Server.Time.AddHours(4);
    }
    else
    {
        ConsecutiveLosses = 0; // Reset on win
    }

    // Update detector performance
    string detector = ExtractDetectorLabel(args.Position.Label);
    if (args.Position.NetProfit > 0)
        DetectorWins[detector]++;
    else
        DetectorLosses[detector]++;
}
```

**Tracked Data**:
- Consecutive losses (for cooldown)
- Detector win/loss (for performance analysis)

---

## Daily Reset Logic

```csharp
private bool CheckRiskManagementGates()
{
    // Reset daily counters at start of new day
    DateTime today = Server.Time.Date;
    if (_state.DailyResetDate != today)
    {
        _state.DailyResetDate = today;
        _state.DailyStartingBalance = Account.Balance;
        _state.DailyTradeCount = 0;
    }

    // ... gate checks
}
```

**Reset at Midnight (Server Time)**:
- Daily starting balance
- Daily trade count
- Daily PnL calculation

**NOT Reset**:
- Consecutive losses (only reset on win)
- Detector performance (cumulative)

---

## Expected Log Output

### Circuit Breaker Activated

```
[14:30] Daily PnL: -3.2% (-$320)
[14:30] ⚠️ CIRCUIT BREAKER ACTIVATED: Daily loss -3.2%
[14:30] Trading disabled until: 2025-10-18 00:00:00
[15:00] Risk gates: BLOCKED (circuit breaker)
```

---

### Cooldown Activated

```
[10:30] Position closed: EURUSD_12345 | PnL: -$50
[11:00] Position closed: EURUSD_12348 | PnL: -$60
[11:00] ⏸️ Trading cooldown activated after 2 consecutive losses
[11:00] Cooldown until: 15:00 UTC
[12:00] Risk gates: BLOCKED (cooldown)
[15:00] Cooldown expired
[15:00] Risk gates: PASS
```

---

### Time-In-Trade Close

```
[01:30] Position opened: EURUSD_12345 | Entry: 1.08500
[09:45] Time in trade: 8.25 hours
[09:45] ⏱️ Closing position due to time limit: EURUSD_12345 (held 8.2h)
[09:45] Position closed at market price
```

---

### Performance HUD

```
[10:00] 📊 Today: 3W/1L | PnL: +1.5% | Trades: 4/6 | Best: OTE 75%
[11:00] 📊 Today: 4W/1L | PnL: +2.1% | Trades: 5/6 | Best: OTE 80%
[12:00] 📊 Today: 4W/2L | PnL: +1.3% | Trades: 6/6 | Best: FVG 67%
```

---

## Bot Parameters (cTrader Settings)

### Risk Group

```
✅ Enable Circuit Breaker = TRUE
✅ Daily Loss Limit % = 3.0
✅ Max Daily Trades = 6
✅ Max Time In Trade (hours) = 8.0
✅ Enable Trade Clustering Prevention = TRUE
✅ Cooldown After Losses = 2
✅ Cooldown Duration (hours) = 4.0
✅ Max Concurrent Positions = 3 (existing)
```

---

## Benefits

### 1. Account Protection

```
✅ Circuit breaker limits daily loss to 3%
✅ Max trades prevents overtrading
✅ Cooldown prevents revenge trading
✅ Time limit prevents "dead trades"
```

---

### 2. Performance Insights

```
✅ Detector win/loss tracking
✅ Identify best performing detectors
✅ Optimize preset Focus settings
✅ Disable underperforming detectors
```

---

### 3. Automated Risk Control

```
✅ No manual intervention needed
✅ Automatic daily reset at midnight
✅ Automatic position closure after time limit
✅ Real-time performance HUD on chart
```

---

### 4. Does NOT Block Valid Entries

```
✅ Risk gates run BEFORE signal generation (efficient)
✅ Independent from trading gates (no conflicts)
✅ Only blocks new entries when risk threshold exceeded
✅ Open positions still managed (BE, partial, trailing)
```

---

## Testing Checklist

### ✅ Step 1: Compile Bot

1. Open cTrader
2. Click **Build**
3. Should compile with **no errors**

---

### ✅ Step 2: Verify Parameters

Check that new parameters exist in cTrader settings:

**Risk Group**:
- ✅ Enable Circuit Breaker
- ✅ Daily Loss Limit %
- ✅ Max Daily Trades
- ✅ Max Time In Trade (hours)
- ✅ Enable Trade Clustering Prevention
- ✅ Cooldown After Losses
- ✅ Cooldown Duration (hours)

---

### ✅ Step 3: Run Backtest

Load Sep-Nov 2023 data and verify:

**Expected Behavior**:
```
✅ Circuit breaker activates after 3% daily loss
✅ Max daily trades stops entries after 6 trades
✅ Time-in-trade closes positions after 8 hours
✅ Cooldown activates after 2 consecutive losses
✅ Performance HUD displays on chart (if debug enabled)
```

---

### ✅ Step 4: Check Logs

Look for:

```
✅ Daily reset: "Daily reset: 2023-09-01 | Starting balance: $10,000"
✅ Circuit breaker: "⚠️ CIRCUIT BREAKER ACTIVATED: Daily loss -3.2%"
✅ Max trades: "Risk gates: BLOCKED (max daily trades)"
✅ Time close: "⏱️ Closing position due to time limit: EURUSD_12345"
✅ Cooldown: "⏸️ Trading cooldown activated after 2 consecutive losses"
✅ Performance: "📊 Today: 5W/2L | PnL: +2.3% | Trades: 7/6 | Best: OTE 71%"
```

Should NOT see:
```
❌ Risk gates blocking when thresholds not exceeded
❌ Risk gates interfering with sequence gate
❌ Risk gates blocking each other
```

---

## Summary

**Added**:
- ✅ Circuit breaker (daily loss limit)
- ✅ Max daily trades limit
- ✅ Max time-in-trade management
- ✅ Trade clustering prevention (cooldown)
- ✅ Performance tracking by detector
- ✅ Performance HUD on chart
- ✅ Automatic position tracking via events

**Integration**:
- ✅ Risk gates run BEFORE signal generation
- ✅ No conflicts with trading gates (sequence, MSS, killzone)
- ✅ Open positions still managed when blocked
- ✅ Daily reset at midnight (server time)

**Result**:
✅ Advanced risk management WITHOUT blocking valid entries
✅ Account protected from daily loss, overtrading, revenge trading
✅ Performance insights to optimize strategy
✅ Fully automated, no manual intervention needed

Your bot now has institutional-grade risk management! 🛡️

---

## Files Modified

- [JadecapStrategy.cs](JadecapStrategy.cs) - Added risk management state, parameters, methods, and event subscriptions

---

## Next Steps

1. ✅ **Compile** bot in cTrader
2. ✅ **Verify** new parameters in Risk group
3. ✅ **Run backtest** to verify risk gates work correctly
4. ✅ **Monitor logs** for circuit breaker, cooldown, time limits
5. ✅ **Enable debug logging** to see performance HUD on chart

Good luck! 🚀
