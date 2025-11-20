# HTF Power of Three Complete Implementation (Oct 25, 2025)

## Executive Summary

**Impact**: 🔴 CRITICAL - Complete implementation of HTF Power of Three bias determination
**Based On**: TradingView HTF Candle Overlay scripts and ICT methodology
**User Request**: "Bias can according this script find from 4h timeframe or 1D timeframe for identify 15 direction"

## Key Concepts Implemented

### Power of Three Pattern
```
Accumulation → Manipulation → Distribution
   (Asia)        (London)        (NY)
```

### HTF Bias Flow for Intraday Trading
```
4H/Daily Bias → 15m Sweep → MSS → OTE Pullback → Continue to Opposite Liquidity
```

## Technical Implementation

### 1. HTF Timeframe Mapping (HtfMapper.cs)

**M5 Trading**: Uses 1H + 4H timeframes
- 1H for intermediate structure
- 4H for directional bias

**M15 Trading**: Uses 4H + Daily timeframes
- 4H for intermediate structure
- Daily for directional bias

```csharp
// Chart 5m → HTF 1H + 4H (intermediate + directional bias)
if (chartTf == TimeFrame.Minute5)
    return (TimeFrame.Hour, TimeFrame.Hour4);

// Chart 15m → HTF 4H + 1D (as per TradingView HTF overlay best practice)
if (chartTf == TimeFrame.Minute15)
    return (TimeFrame.Hour4, TimeFrame.Daily);
```

### 2. Power of Three Phase Detection (BiasStateMachine.cs)

**Time-Based Phases**:
```csharp
private PowerOfThreePhase GetPowerOfThreePhase(DateTime utcTime)
{
    int hour = utcTime.Hour;

    // Asian session (00:00 - 09:00 UTC) - Accumulation
    if (hour >= 0 && hour < 9)
        return PowerOfThreePhase.Accumulation;

    // London session (09:00 - 13:00 UTC) - Manipulation
    if (hour >= 9 && hour < 13)
        return PowerOfThreePhase.Manipulation;

    // NY session (13:00 - 24:00 UTC) - Distribution
    return PowerOfThreePhase.Distribution;
}
```

### 3. HTF Bias Determination

**Bias Criteria** (from HTF candles):
- Bullish: HTF close > open, higher highs, higher lows
- Bearish: HTF close < open, lower highs, lower lows

```csharp
private void CheckHTFPowerOfThreeBias()
{
    // Get 4H/Daily candles based on chart timeframe
    var htfBars = _htfData.GetHtfBars(_htfSecondary);

    // Analyze last 2 completed HTF candles
    bool htfBullish = htfClose > htfOpen &&
                      htfHigh > prevHigh &&
                      htfLow > prevLow &&
                      htfClose > prevClose;

    // Establish bias during accumulation phase
    if (phase == PowerOfThreePhase.Accumulation && _confirmedBias == null)
    {
        if (htfBullish)
        {
            _confirmedBias = BiasDirection.Bullish;
            _state = BiasState.CONFIRMED_BIAS;
        }
    }
}
```

### 4. Bias Persistence Throughout Trading Day

**Three Layers of Persistence**:

1. **BiasStateMachine Level**: Bias not cleared on Reset()
```csharp
public void Reset()
{
    _state = BiasState.IDLE;
    _candidateBias = null;
    // _confirmedBias = null;  // REMOVED - keeps bias throughout day
}
```

2. **JadecapStrategy Level**: LastHTFBias field maintains bias
```csharp
if (htfBias.HasValue)
{
    _state.LastHTFBias = htfBias.Value; // Store for persistence
    bias = htfBias.Value;
}
else
{
    // Maintain last known HTF bias instead of defaulting to Neutral
    bias = _state.LastHTFBias ?? _marketData.GetCurrentBias();
}
```

3. **Daily Reset**: Only at Asia session start (00:00 UTC)
```csharp
if (utcHour == 0 && utcMinute < 5)
{
    if (_state.LastDailyResetDate != utcNow.Date)
    {
        _biasStateMachine.DailyReset();
        _state.LastHTFBias = null; // Clear for new day
    }
}
```

## Complete Trading Cycle

### Daily Flow with Power of Three

```
00:00 UTC - Asia Start (Accumulation)
├─ Daily Reset clears previous bias
├─ HTF 4H/Daily structure analyzed
├─ Initial bias established from HTF candles
└─ Bias locked for the day

09:00 UTC - London Start (Manipulation)
├─ Bias persists from accumulation
├─ Sweep of opposite liquidity expected
├─ MSS confirms continuation
└─ Bias unchanged even if state changes

13:00 UTC - NY Start (Distribution)
├─ Bias still persists
├─ Continue in bias direction
├─ Target opposite liquidity
└─ Bias maintained until 00:00 UTC

Next 00:00 UTC - Cycle repeats
```

### Intraday Entry Flow (Per Your Description)

```
1. HTF Bias Established (4H/Daily)
   ↓
2. 15m Sweep (Liquidity Grabbed)
   "when 15 min sweep (grabed) liquidity"
   ↓
3. MSS in True Direction
   "will go true direction and make mss"
   ↓
4. Pullback to OTE
   "after it will make pull back to ote"
   ↓
5. Continue to Opposite Liquidity
   "again continue bias direction until grab opposite liquidity"
```

## Expected Behavior

### Before Implementation
```
00:00 - Asian session starts
03:00 - Some HTF analysis but no clear bias
09:00 - Asian ends, bias = NEUTRAL ❌
10:00 - London trading without direction
15:00 - NY trading still neutral
```

### After Implementation
```
00:00 - Asian session starts, HTF analysis begins
03:00 - HTF 4H bullish structure detected
03:01 - Bias = BULLISH, locked for day ✅
09:00 - Asian ends, bias still BULLISH
10:00 - London sweep of lows (manipulation)
10:30 - MSS confirms bullish continuation
11:00 - OTE pullback entry opportunities
15:00 - NY continues bullish to opposite liquidity
23:59 - Bias still BULLISH
00:00 - Next day reset, new cycle
```

## Key Features Aligned with TradingView HTF Scripts

### 1. Multi-Timeframe Overlay Concept
- Lower timeframe chart (M5/M15) with HTF bias overlay
- 4-6x ratio between timeframes (M5→4H = 48x, M15→Daily = 96x)
- No repainting - uses completed HTF candles only

### 2. Structure & Liquidity Recognition
- **Wick Sweeps**: HTF wicks indicate liquidity grabs
- **Inside Consolidations**: Price coiling within HTF candle body
- **Breakout Potential**: When price exits HTF range

### 3. Entry Optimization
- Wait for setup inside HTF range
- Stop below HTF low (bullish) or above HTF high (bearish)
- Target opposite HTF extreme

## Build Status

✅ **Build Successful**
```
Build succeeded.
    0 Warning(s)
    0 Error(s)
Time Elapsed 00:00:05.02
```

## Files Modified

1. **HtfMapper.cs**: Updated HTF mapping for proper Power of Three timeframes
2. **BiasStateMachine.cs**: Added Power of Three phase detection and HTF bias logic
3. **JadecapStrategy.cs**: Implemented bias persistence and daily reset mechanism

## Monitoring & Verification

### Key Log Messages to Watch

**Good Indicators**:
```
[HTF Power of Three] Bullish bias established from Hour4 structure
[BiasStateMachine] Reset to IDLE (keeping bias: Bullish)
[HTF BIAS] Using state machine bias: Bullish (state=IDLE, lastHTF=Bullish)
[HTF DAILY RESET] New trading day at 2025-10-26 00:00 UTC - bias cleared
```

**Phase Transitions**:
```
00:00-09:00: "Phase: Accumulation"
09:00-13:00: "Phase: Manipulation"
13:00-24:00: "Phase: Distribution"
```

## Risk Assessment

### Improvements
- ✅ Proper HTF bias from 4H/Daily timeframes
- ✅ Power of Three phase awareness
- ✅ Bias persistence throughout trading day
- ✅ Clear daily reset boundaries
- ✅ Alignment with ICT methodology

### Considerations
- HTF analysis depends on sufficient bar history
- Time zones assume UTC (server time conversion handled)
- Bias strength may vary based on HTF candle quality

## Conclusion

The implementation now correctly follows the HTF Power of Three methodology:

1. **HTF Bias**: Determined from 4H/Daily candles (not lower timeframes)
2. **Phase Awareness**: Accumulation → Manipulation → Distribution
3. **Persistence**: Bias maintained throughout entire trading day
4. **Daily Reset**: Clean slate at 00:00 UTC for new accumulation

The bot will now:
- Establish bias during Asian accumulation from HTF structure
- Maintain that bias through London manipulation (sweeps)
- Continue bias through NY distribution
- Only reset at the new trading day

This aligns with your TradingView HTF overlay references and ICT Power of Three concepts.

---

**Status**: ✅ IMPLEMENTED & DEPLOYED
**Priority**: 🔴 P0 - Core trading logic alignment
**Implementation Date**: 2025-10-25
**Build**: CCTTB.algo (Debug/net6.0)