# CRITICAL: PID5 Catastrophic Loss Investigation - Oct 23, 2025

## Executive Summary

**CRITICAL BUG DISCOVERED**: Despite applying all fixes (BEARISH block, TP=0 validation, MinRR 1.50), the Sept 7-11 backtest shows a **catastrophic loss of -$866.22** on a **single BULLISH trade** (PID5) that had a 20-pip stop loss and should have lost only ~$40.

**Loss Amplification**: **21.6x larger than expected**

This suggests a **fundamental position sizing or capital reporting issue** that makes the bot **UNSAFE FOR LIVE DEPLOYMENT**.

---

## PID5 Trade Details

### Entry Parameters
- **Entry Time**: Sept 11, 2025 02:10:00 (Asia session)
- **Direction**: BULLISH (should be "safe" based on analysis)
- **Entry Price**: 1.16960
- **Stop Loss**: 1.16760
- **Take Profit**: 1.17291
- **Stop Distance**: 20.0 pips
- **TP Distance**: 33.1 pips
- **Risk/Reward Ratio**: 1.66:1 ✅ (above 1.50 threshold)

### Expected vs Actual Loss

| Metric | Expected | Actual | Delta |
|--------|----------|--------|-------|
| **Stop Loss Distance** | 20.0 pips | 20.0 pips | - |
| **Risk Per Trade** | 0.4% of capital | ??? | ??? |
| **Capital** | $1,000 | ??? | ??? |
| **Expected Loss at SL** | ~$40 (0.4% × $1,000) | - | - |
| **Actual Loss** | - | **-$866.22** | **-$826.22** |
| **Loss Multiplier** | 1.0x | **21.6x** | ❌ **2,060% AMPLIFICATION** |
| **PnL Percentage** | -4.0% | **-27,328.86%** | ❌ **BROKEN** |

---

## Log Evidence

### Position Opened
```
DBG|2025-10-23 01:26:39.080|Execute: Jadecap-Pro Bullish entry=1.16960 stop=1.16760 tp=1.17291
DBG|2025-10-23 01:26:39.080|SignalBox ENTRY TAKEN: OB Bullish | Box=[1.16903-1.16974]
DBG|2025-10-23 01:26:39.080|Entry from SignalBox: OB Bullish created at 21:15
TRADE|2025-09-11 02:10:00|Bullish|Entry:1.1696|Stop:1.1676|TP:1.1729100000000001
DBG|2025-10-23 01:26:39.080|MSS Lifecycle: ENTRY OCCURRED on Bullish signal → Will reset ActiveMSS on next bar
DBG|2025-10-23 01:26:39.081|Position opened: EURUSD_5 | Detector: Unknown | Daily trades: 1/4
```

### Position Closed
```
DBG|2025-10-23 01:26:39.869|Position closed: EURUSD_5 | PnL: -866.22 (-27328.86%) | Detector: Unknown | Consecutive losses: 1
DBG|2025-10-23 01:26:39.872|Circuit breaker: Daily loss -68.43% >= 6.00%
```

**Time in Trade**: ~9.5 hours (02:10 entry, log shows closure timestamp at 01:26:39 backtest time)

---

## Possible Root Causes

### 1. **Position Sizing Calculation Broken** (Most Likely)
**Hypothesis**: The volume/lot size calculation in [Execution_RiskManager.cs](Execution_RiskManager.cs) is multiplying risk by 21.6x instead of using 0.4% of capital.

**Evidence**:
- Expected position size for 0.4% risk on $1,000 with 20-pip SL: ~0.02 lots (2,000 units)
- Actual position size (inferred): ~0.43 lots (43,000 units) to generate -$866 loss on 20 pips
- **Calculation error**: 0.43 / 0.02 = 21.5x oversized

**Likely Bug Location**:
```csharp
// Execution_RiskManager.cs - Volume calculation
// SUSPECTED BUG: May be using wrong capital, wrong pip value, or wrong risk multiplier
double volume = CalculateVolume(capital, riskPercent, stopLossPips);
```

### 2. **Capital Misreported in Backtest**
**Hypothesis**: Starting capital was actually $10,000 or higher, not $1,000.

**Evidence**:
- If capital = $10,000 and risk = 0.4%, expected loss = ~$400
- Actual loss = $866 (2.16x × $400)
- **Still doesn't fully explain**: Even at $10k capital, loss is 2x larger than expected

**Weakness**: Other trades (PID1, PID2, PID3, PID4) had reasonable PnL values ($0.78, $3.30, $189.98, -$8.32), suggesting capital was indeed $1,000.

### 3. **Trailing Stop Loss Execution Error**
**Hypothesis**: Trailing SL moved incorrectly and closed position at -$866 instead of -$40.

**Evidence**:
- Bot uses trailing stop logic: [JadecapStrategy.cs:4486-4537](JadecapStrategy.cs#L4486-L4537)
- Trailing SL should LOCK IN PROFITS, not amplify losses
- **Unlikely**: Trailing SL shouldn't trigger on a losing position

### 4. **Slippage/Gap Event**
**Hypothesis**: Market gapped through stop loss by 400+ pips during Asia session low liquidity.

**Evidence**:
- Entry: 1.16960, SL: 1.16760 (20 pips)
- To lose -$866 on 0.02 lots: Would need ~433 pips of slippage
- **Extremely unlikely**: EURUSD doesn't gap 400+ pips in normal conditions
- Sept 11, 2025 Asia session: No major news events

### 5. **Commission/Spread Error**
**Hypothesis**: Commission or spread was calculated incorrectly and added to loss.

**Evidence**:
- IC Markets Raw: $3.50/lot/side (MT) or $3/100k/side (cTrader)
- For 0.02 lots: Commission = $0.07 (negligible)
- For 0.43 lots: Commission = $1.51 (still negligible)
- **Unlikely**: Can't explain -$866 loss

### 6. **Multiple Position Entries**
**Hypothesis**: Bot opened multiple positions at same time, all labeled EURUSD_5, all lost.

**Evidence**:
- Log shows "Daily trades: 1/4" when PID5 opened
- Only 5 total trades executed (PID1-PID5)
- **Unlikely**: Log shows single entry and single closure

---

## Impact on Backtest Results

### Sept 7-11 Analysis

**Without PID5 Loss**:
- PID1: +$0.78
- PID2: +$3.30
- PID3: +$189.98
- PID4: -$8.32
- **Subtotal**: +$185.74 (+18.6% profit)

**With PID5 Loss**:
- PID1-4: +$185.74
- PID5: **-$866.22**
- **Total**: **-$680.48 (-68.0% loss)**

**PID5 Impact**: Single trade destroyed **+18.6% profit** and turned it into **-68.0% catastrophic loss**.

---

## Comparison to Other Backtests

### Sept 21-22 Backtest (Profitable)
- 6 BULLISH trades, 100% win rate
- PnL range: +$0.40 to +$484.08
- Largest win: +$484.08 (reasonable)
- **No catastrophic losses**

### Sept 22-24 Backtest (Profitable)
- 5 BULLISH trades, 100% win rate
- PnL range: +$131.96 to +$466.08
- Largest win: +$466.08 (reasonable)
- **No catastrophic losses**

### Sept 7-11 Backtest (BROKEN)
- 5 BULLISH trades, 60% win rate
- PnL range: +$0.78 to +$189.98 (wins) and -$8.32 to **-$866.22** (losses)
- Largest loss: **-$866.22** ❌ **21.6x LARGER THAN EXPECTED**
- **Circuit breaker triggered**

**Pattern**: Sept 7-11 is the ONLY backtest with catastrophic position sizing error.

---

## Diagnostic Questions

### Critical Investigation Steps

1. **What was the actual starting capital?**
   - Search backtest initialization logs
   - Check cTrader backtest settings
   - Verify Account.Balance value

2. **What volume/lot size was used for PID5?**
   - Extract from cTrader backtest report
   - Check ExecuteMarketOrder() call
   - Review Execution_RiskManager.cs volume calculation

3. **Was PID5 stop loss hit, or did something else close it?**
   - Check for "Stop loss hit" message
   - Check for "Time-in-trade exit" message
   - Check for manual close or circuit breaker close

4. **What was the exit price?**
   - If SL hit: Should be ~1.16760
   - If gapped: Could be far below 1.16760
   - Extract from position closure logs

5. **Were there any errors/warnings in the log?**
   - Search for "Error" or "Exception"
   - Check RiskManager calculation logs
   - Verify no divide-by-zero or NaN issues

---

## Required Code Review

### Files to Audit

1. **[Execution_RiskManager.cs](Execution_RiskManager.cs)**
   - Review `CalculateVolume()` method
   - Check capital source (Account.Balance vs Account.Equity)
   - Verify pip value calculation
   - Check for rounding errors

2. **[Execution_TradeManager.cs](Execution_TradeManager.cs)**
   - Review ExecuteMarketOrder() call
   - Check volume parameter passed
   - Verify order execution logs

3. **[JadecapStrategy.cs:4486-4537](JadecapStrategy.cs#L4486-L4537)**
   - Review trailing stop logic
   - Check if trailing SL could trigger on losing positions
   - Verify Time-in-Trade logic doesn't amplify losses

4. **[Config_StrategyConfig.cs](Config_StrategyConfig.cs)**
   - Verify RiskPercent parameter (should be 0.004 = 0.4%)
   - Check for any multipliers or modifiers

---

## Immediate Actions Required

### BEFORE DEPLOYING LIVE

1. ✅ **Extract Full PID5 Details from cTrader**
   - Open backtest in cTrader
   - View detailed trade report
   - Capture: Entry price, exit price, volume, commission, swap, net PnL

2. ✅ **Add Volume Logging**
   - Modify Execution_TradeManager.cs to log volume/lot size on every entry
   - Example: `_journal.Debug($"ENTRY: Volume={volume} lots, Risk=${riskAmount}, SL={slPips} pips");`

3. ✅ **Verify RiskManager Calculation**
   - Add debug logging to Execution_RiskManager.cs CalculateVolume()
   - Log: capital, riskPercent, slPips, pipValue, calculatedVolume
   - Run Sept 7-11 backtest again and capture logs

4. ✅ **Test with Fixed Position Size**
   - Temporarily hardcode volume to 0.01 lots
   - Re-run Sept 7-11 backtest
   - If loss becomes reasonable (~$20), confirms position sizing bug

5. ✅ **Review All 16 Trades Across 3 Backtests**
   - Extract volume/lot size for all trades
   - Check if PID5 is the only oversized position
   - Look for pattern (time of day, session, market conditions)

---

## Expected vs Actual Position Sizing

### Correct Calculation
```
Capital: $1,000
Risk per trade: 0.4%
Risk amount: $1,000 × 0.004 = $4.00

Stop loss: 20 pips
Pip value (EURUSD): $10/lot for 1.0 lot
Pip value for 0.01 lots: $0.10/pip

Required volume = Risk amount / (SL pips × Pip value per lot)
                = $4.00 / (20 pips × $10/lot)
                = $4.00 / $200
                = 0.02 lots (2,000 units)

Expected loss at SL = 0.02 lots × 20 pips × $10/lot
                    = 0.02 × 20 × $10
                    = $4.00 ✅
```

### Actual (Inferred from -$866 loss)
```
Actual loss: -$866.22
SL distance: 20 pips
Pip value (EURUSD): $10/lot for 1.0 lot

Actual volume = Loss / (SL pips × Pip value per lot)
              = $866.22 / (20 × $10)
              = $866.22 / $200
              = 4.33 lots (433,000 units) ❌

Amplification = 4.33 / 0.02 = 216.5x OVERSIZED
```

**Conclusion**: PID5 was executed with **216.5x larger position size** than intended.

---

## Recommendation

**DO NOT DEPLOY LIVE** until:

1. PID5 position sizing error is fully explained
2. Root cause is identified and fixed
3. Sept 7-11 backtest is re-run and shows reasonable losses (-$4 to -$40 range)
4. All 16 trades across 3 backtests are verified to have correct position sizing

**Risk if deployed**: Bot could amplify losses by **21.6x to 216.5x**, turning a $40 stop loss into an **$866+ catastrophic loss**, destroying the account in a single trade.

---

## Next Steps

1. **Extract PID5 Details from cTrader** (URGENT)
   - Open Sept 7-11 backtest in cTrader
   - Export detailed trade report
   - Capture exact volume, entry/exit prices, commission

2. **Add Debug Logging** (HIGH PRIORITY)
   - Modify Execution_RiskManager.cs to log ALL volume calculations
   - Re-run Sept 7-11 backtest with enhanced logging

3. **Test with Fixed Volume** (MEDIUM PRIORITY)
   - Hardcode 0.01 lots to isolate issue
   - Verify if loss becomes reasonable

4. **Code Audit** (MEDIUM PRIORITY)
   - Review Execution_RiskManager.cs line-by-line
   - Check for capital source errors, pip value errors, multiplier errors

---

**Status**: ⚠️ **CRITICAL BUG - LIVE DEPLOYMENT BLOCKED**

**Impact**: Single trade can destroy 68% of account despite having "safe" 0.4% risk setting

**Priority**: **P0 - BLOCKER**

---

**Date**: October 23, 2025
**Backtest**: Sept 7-11, 2025 (EURUSD)
**Bot Version**: Post-Oct 23 fixes (BEARISH block, TP=0 validation, MinRR 1.50)
