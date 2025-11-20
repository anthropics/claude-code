# HTF-Aware Orchestrated Bias + Sweep System - Implementation Spec

**Date**: October 24, 2025
**Status**: SPECIFICATION - NOT YET IMPLEMENTED
**Priority**: HIGH (addresses root cause of 0 entries in backtest)

---

## Executive Summary

**Current Problem**:
- entryDir=Neutral blocks ALL entries (8,609 blocks in Sep 18-25 backtest)
- Bias/sweep detection is NOT HTF-aware (uses single TF)
- No formal gate system (MSS/OTE can run before bias confirmed)

**Proposed Solution**:
1. **Short-term fix**: Fix entryDir=Neutral logic (IMMEDIATE)
2. **Long-term replacement**: Unified HTF-aware Bias+Sweep system with state machine gates (PHASE 2)

---

## Part 1: IMMEDIATE FIX (entryDir=Neutral)

**Problem**: Line 2601 in JadecapStrategy.cs allows entryDir to be Neutral, blocking all POI types.

**Fix Applied**: See [SEQUENCEGATE_BLOCKING_ALL_ENTRIES_FIX.md](SEQUENCEGATE_BLOCKING_ALL_ENTRIES_FIX.md)

**Implementation**:
```csharp
// Line 2601 - BEFORE:
var entryDir = lastMss != null ? lastMss.Direction : bias;

// Line 2601 - AFTER:
var entryDir = (lastMss != null && lastMss.Direction != BiasDirection.Neutral)
    ? lastMss.Direction
    : bias;

// If still Neutral, use most recent valid MSS direction
if (entryDir == BiasDirection.Neutral && mssSignals != null)
{
    var recentValidMss = mssSignals.LastOrDefault(s => s.IsValid && s.Direction != BiasDirection.Neutral);
    if (recentValidMss != null)
    {
        entryDir = recentValidMss.Direction;
        if (_config.EnableDebugLogging)
            _journal.Debug($"BuildSignal: HTF bias Neutral, using recent MSS direction: {entryDir}");
    }
}
```

**Status**: Ready to implement NOW (user decision pending)

---

## Part 2: LONG-TERM HTF-AWARE SYSTEM (New Architecture)

### Overview

Replace existing bias/sweep modules with a **unified, HTF-aware, state-machine-driven** system that:
1. **Auto-selects HTF pairs** based on chart timeframe
2. **Enforces strict gate sequencing**: Sweep → Bias → MSS → Entry
3. **Emits JSON events** for orchestrator integration
4. **Prevents premature entry** execution

---

### 2.1 HTF Definitions (Fixed Mappings)

**Chart TF = 15m**:
- HTF1 (primary): 4H
- HTF2 (secondary): 1D

**Chart TF = 5m**:
- HTF3 (primary): 15m
- HTF4 (secondary): 1H

**Auto-Mapping Policy**:
```csharp
public class HtfMapper
{
    public (TimeFrame primary, TimeFrame secondary) GetHtfSet(TimeFrame chartTf)
    {
        if (chartTf == TimeFrame.Minute5)
            return (TimeFrame.Minute15, TimeFrame.Hour);
        else if (chartTf == TimeFrame.Minute15)
            return (TimeFrame.Hour4, TimeFrame.Daily);
        else
            throw new ArgumentException($"Unsupported chart TF: {chartTf}");
    }
}
```

**Chart TF Change Behavior**:
- When chart TF switches (5m ↔ 15m):
  1. Auto-select new HTF set
  2. Reset state machine to IDLE
  3. Recompute all reference levels (PDH/PDL/Asia/HTF H/L)
  4. Clear cached sweeps/bias

---

### 2.2 Liquidity References (Per Active HTF Set)

**Reference Levels** (computed fresh on each HTF set change):

1. **PDH/PDL** (Previous Day High/Low)
2. **Asia_H/L** (Asia session high/low)
3. **HTF_H/L** (Current HTF candle high/low for EACH active HTF)
4. **Prev_HTF_H/L** (Previous HTF candle high/low for EACH active HTF)
5. **Session highs/lows** (London/NY open session ranges - optional)

**Example for 15m chart (HTF=4H/1D)**:
```
References:
- PDH = 1.1850
- PDL = 1.1730
- Asia_H = 1.1820
- Asia_L = 1.1750
- 4H_H = 1.1840 (current 4H candle high)
- 4H_L = 1.1760 (current 4H candle low)
- Prev_4H_H = 1.1830 (previous 4H candle high)
- Prev_4H_L = 1.1740 (previous 4H candle low)
- 1D_H = 1.1850 (today's high)
- 1D_L = 1.1730 (today's low)
- Prev_1D_H = 1.1880 (yesterday's high)
- Prev_1D_L = 1.1710 (yesterday's low)
```

---

### 2.3 Threshold Configuration (Symbol-Aware)

**ATR-Based Thresholds**:
```json
{
  "thresholds": {
    "breakFactor_ATR": 0.25,      // Min overshoot: 0.25 × ATR_LTF
    "confirmBars": 3,             // Bars to wait for close-inside confirmation
    "dispMult_ATR": 0.75,         // Min displacement: 0.75 × ATR_LTF
    "flipThresh_ATR": 1.0,        // Invalidation threshold: 1.0 × ATR_LTF
    "confirmWindow_min": 300      // Confirmation timeout: 5 hours
  }
}
```

**ATR Calculation**:
- Use **LTF ATR** (chart timeframe, not HTF)
- Period: 14 bars
- Type: Simple Moving Average

**Example (EURUSD M5)**:
```
ATR_LTF = 4.5 pips (14-period on M5)
breakFactor = 0.25 × 4.5 = 1.125 pips
dispMult = 0.75 × 4.5 = 3.375 pips
flipThresh = 1.0 × 4.5 = 4.5 pips
```

---

### 2.4 State Machine (Gate Enforcement)

**States**:
```
IDLE → CANDIDATE → CONFIRMED_BIAS → READY_FOR_MSS
  ↓
INVALIDATED (reset to IDLE)
```

**State Descriptions**:

1. **IDLE**
   - No active bias or sweep
   - MSS/OTE/Entry BLOCKED
   - Waiting for liquidity sweep

2. **CANDIDATE**
   - Valid sweep detected
   - Candidate bias set (BUY or SELL)
   - MSS/OTE/Entry BLOCKED
   - Waiting for confirmation

3. **CONFIRMED_BIAS**
   - Bias confirmed by close > DO or range expansion
   - Confidence level assigned (low/base/high)
   - MSS/OTE/Entry BLOCKED
   - Waiting for MSS detection

4. **READY_FOR_MSS**
   - **GATE OPEN** for MSS detection
   - MSS allowed to run
   - After MSS confirmed: OTE/POI/Entry allowed

5. **INVALIDATED**
   - Opposite sweep + displacement ≥ flipThresh
   - Reset to IDLE
   - Close all gates

---

### 2.5 State Transitions

#### IDLE → CANDIDATE

**Trigger**: Valid liquidity sweep at any active reference level

**SweepUp (Bearish Candidate)**:
```
Conditions:
1. Price crosses ABOVE ref + breakFactor×ATR
2. Within confirmBars, close BELOW ref (wick above, body inside)
3. Displacement down ≥ dispMult×ATR (measured from sweep high to close)

Result:
- CandidateBias = SELL
- State = CANDIDATE
- Emit: "liquidity_sweep_detected" + "bias_candidate_set"
```

**SweepDown (Bullish Candidate)**:
```
Conditions:
1. Price crosses BELOW ref - breakFactor×ATR
2. Within confirmBars, close ABOVE ref (wick below, body inside)
3. Displacement up ≥ dispMult×ATR (measured from sweep low to close)

Result:
- CandidateBias = BUY
- State = CANDIDATE
- Emit: "liquidity_sweep_detected" + "bias_candidate_set"
```

**Implementation**:
```csharp
public class BiasStateMachine
{
    private BiasState _state = BiasState.IDLE;
    private BiasDirection? _candidateBias = null;
    private DateTime _candidateTime;
    private double _sweepPrice;
    private string _sweepRef;

    public bool CheckForSweep(Bars bars, List<LiquidityReference> refs, double atrLtf)
    {
        if (_state != BiasState.IDLE) return false;

        int idx = bars.Count - 1;
        double high = bars.HighPrices[idx];
        double low = bars.LowPrices[idx];
        double close = bars.ClosePrices[idx];
        double breakFactor = 0.25 * atrLtf;

        foreach (var r in refs)
        {
            // Check SweepUp (Bearish)
            if (high > r.Level + breakFactor)
            {
                // Check for close inside + displacement
                if (CheckSweepUpConfirmation(bars, idx, r.Level, atrLtf))
                {
                    _candidateBias = BiasDirection.Bearish;
                    _state = BiasState.CANDIDATE;
                    _candidateTime = bars.OpenTimes[idx];
                    _sweepPrice = high;
                    _sweepRef = r.Label;
                    EmitEvent("liquidity_sweep_detected", "up", r);
                    EmitEvent("bias_candidate_set", "SELL", r);
                    return true;
                }
            }

            // Check SweepDown (Bullish)
            if (low < r.Level - breakFactor)
            {
                if (CheckSweepDownConfirmation(bars, idx, r.Level, atrLtf))
                {
                    _candidateBias = BiasDirection.Bullish;
                    _state = BiasState.CANDIDATE;
                    _candidateTime = bars.OpenTimes[idx];
                    _sweepPrice = low;
                    _sweepRef = r.Label;
                    EmitEvent("liquidity_sweep_detected", "down", r);
                    EmitEvent("bias_candidate_set", "BUY", r);
                    return true;
                }
            }
        }
        return false;
    }

    private bool CheckSweepUpConfirmation(Bars bars, int idx, double refLevel, double atrLtf)
    {
        double dispMult = 0.75 * atrLtf;
        int confirmBars = 3;

        for (int i = idx; i < Math.Min(idx + confirmBars, bars.Count); i++)
        {
            double close = bars.ClosePrices[i];
            if (close < refLevel) // Close back inside
            {
                double displacement = bars.HighPrices[idx] - close;
                if (displacement >= dispMult)
                    return true;
            }
        }
        return false;
    }
}
```

#### CANDIDATE → CONFIRMED_BIAS

**Trigger**: Confirmation metric met within confirmWindow

**BUY Candidate Confirmation**:
```
Any of:
1. Close > DO (Daily Open)
2. Close > Asia_H (breaks above Asia session high)
3. Range expansion up (measured by ATR increase or body size)

Result:
- Bias = BUY
- State = CONFIRMED_BIAS
- Confidence = low|base|high (based on HTF alignment)
- Emit: "bias_confirmed"
```

**SELL Candidate Confirmation**:
```
Mirror conditions downward
```

**Confidence Grading**:
```csharp
public ConfidenceLevel GradeConfidence(BiasDirection bias, Bars htfPrimary, Bars htfSecondary)
{
    int score = 1; // base

    // Check HTF body alignment
    if (htfPrimary != null && htfPrimary.Count > 0)
    {
        double htfClose = htfPrimary.ClosePrices.LastValue;
        double htfOpen = htfPrimary.OpenPrices.LastValue;
        bool htfBullish = htfClose > htfOpen;
        bool htfBearish = htfClose < htfOpen;

        if (bias == BiasDirection.Bullish && htfBullish) score++;
        if (bias == BiasDirection.Bearish && htfBearish) score++;
    }

    if (htfSecondary != null && htfSecondary.Count > 0)
    {
        double htfClose = htfSecondary.ClosePrices.LastValue;
        double htfOpen = htfSecondary.OpenPrices.LastValue;
        bool htfBullish = htfClose > htfOpen;
        bool htfBearish = htfClose < htfOpen;

        if (bias == BiasDirection.Bullish && htfBullish) score++;
        if (bias == BiasDirection.Bearish && htfBearish) score++;
    }

    if (score >= 3) return ConfidenceLevel.High;
    if (score == 2) return ConfidenceLevel.Base;
    return ConfidenceLevel.Low;
}
```

#### CONFIRMED_BIAS → READY_FOR_MSS

**Trigger**: Immediate (no additional wait)

**Action**: Open gate for MSS detection

**Result**:
- State = READY_FOR_MSS
- Emit: "gate_open" (module=MSS)

**Gate Enforcement**:
```csharp
public bool IsMssAllowed()
{
    return _state == BiasState.READY_FOR_MSS;
}

// In MSS detector:
public List<MSSSignal> DetectMSS(...)
{
    if (!_biasStateMachine.IsMssAllowed())
    {
        if (_config.EnableDebugLogging)
            _journal.Debug("MSS: BLOCKED by bias gate (state not READY_FOR_MSS)");
        return new List<MSSSignal>();
    }

    // Normal MSS detection proceeds...
}
```

#### ANY → INVALIDATED

**Trigger**: Opposite sweep + move ≥ flipThresh

**Example (BUY bias invalidation)**:
```
Current: Bias = BUY, State = CONFIRMED_BIAS or READY_FOR_MSS
Event: SweepDown at PDL + close BELOW PDL - flipThresh×ATR

Result:
- State = INVALIDATED
- Emit: "bias_invalidated" + "gate_close"
- Reset to IDLE
```

**Implementation**:
```csharp
public void CheckInvalidation(Bars bars, List<LiquidityReference> refs, double atrLtf)
{
    if (_state == BiasState.IDLE || _state == BiasState.INVALIDATED) return;

    double flipThresh = 1.0 * atrLtf;
    int idx = bars.Count - 1;
    double close = bars.ClosePrices[idx];

    if (_candidateBias == BiasDirection.Bullish)
    {
        // Check for bearish sweep + move
        foreach (var r in refs)
        {
            if (bars.LowPrices[idx] < r.Level - flipThresh)
            {
                if (close < r.Level - flipThresh)
                {
                    EmitEvent("bias_invalidated", "BUY", "opposite_sweep");
                    EmitEvent("gate_close", "MSS", "bias_invalidated");
                    Reset();
                    return;
                }
            }
        }
    }
    else if (_candidateBias == BiasDirection.Bearish)
    {
        // Mirror for bullish sweep
        foreach (var r in refs)
        {
            if (bars.HighPrices[idx] > r.Level + flipThresh)
            {
                if (close > r.Level + flipThresh)
                {
                    EmitEvent("bias_invalidated", "SELL", "opposite_sweep");
                    EmitEvent("gate_close", "MSS", "bias_invalidated");
                    Reset();
                    return;
                }
            }
        }
    }
}
```

---

### 2.6 JSON Event Contract

**Event Structure**:
```json
{
  "event": "event_name",
  "timestamp": "ISO-8601",
  "chartTf": "5m|15m",
  "activeHtfs": ["15m", "1H"] or ["4H", "1D"],
  "data": { ... }
}
```

**Event Types**:

1. **liquidity_sweep_detected**
```json
{
  "event": "liquidity_sweep_detected",
  "dir": "up|down",
  "ref": "PDH|PDL|Asia_H|Asia_L|4H_H|1D_L|...",
  "htf": "4H|1D|15m|1H|null",
  "price": 1.18500,
  "time": "2025-09-18T05:15:00Z"
}
```

2. **bias_candidate_set**
```json
{
  "event": "bias_candidate_set",
  "candidate": "BUY|SELL",
  "reason": "sweep_up|sweep_down",
  "ref": "PDH",
  "htf": "4H",
  "time": "2025-09-18T05:15:00Z"
}
```

3. **bias_confirmed**
```json
{
  "event": "bias_confirmed",
  "bias": "BUY|SELL",
  "confidence": "low|base|high",
  "confirm_metric": "close>DO|close>Asia_H|rangeExp",
  "active_htfs": ["4H", "1D"],
  "time": "2025-09-18T05:30:00Z"
}
```

4. **gate_open**
```json
{
  "event": "gate_open",
  "module": "MSS",
  "reason": "bias_confirmed",
  "time": "2025-09-18T05:30:00Z"
}
```

5. **gate_close**
```json
{
  "event": "gate_close",
  "module": "MSS",
  "reason": "bias_invalidated|timeout|tf_change",
  "time": "2025-09-18T07:45:00Z"
}
```

6. **bias_invalidated**
```json
{
  "event": "bias_invalidated",
  "from": "BUY|SELL|CANDIDATE",
  "to": "IDLE",
  "reason": "opposite_sweep|flip_threshold|timeout",
  "time": "2025-09-18T07:45:00Z"
}
```

7. **mss_confirmed** (downstream, unchanged)
```json
{
  "event": "mss_confirmed",
  "side": "BUY|SELL",
  "level": "swingH|swingL",
  "price": 1.18700,
  "time": "2025-09-18T06:00:00Z"
}
```

8. **entry_ready_zone** (downstream, unchanged)
```json
{
  "event": "entry_ready_zone",
  "zone": "OTE|OB|FVG|BREAKER",
  "side": "BUY|SELL",
  "bounds": [1.18600, 1.18650],
  "time": "2025-09-18T06:15:00Z"
}
```

---

### 2.7 Orchestrator Configuration

**Full Config Example**:
```json
{
  "tf_map": {
    "5m": {
      "active_htfs": ["15m", "1H"],
      "primary": "15m",
      "secondary": "1H"
    },
    "15m": {
      "active_htfs": ["4H", "1D"],
      "primary": "4H",
      "secondary": "1D"
    }
  },
  "thresholds": {
    "breakFactor_ATR": 0.25,
    "confirmBars": 3,
    "dispMult_ATR": 0.75,
    "flipThresh_ATR": 1.0,
    "confirmWindow_min": 300
  },
  "refs": [
    "PDH", "PDL",
    "Asia_H", "Asia_L",
    "HTF_H", "HTF_L",
    "Prev_HTF_H", "Prev_HTF_L",
    "London_Open", "NY_Open"
  ],
  "confluence": {
    "use_htf_body_alignment": true,
    "use_htf_trend_filter": false
  },
  "gates": {
    "enforce_strict_sequence": true,
    "allow_mss_without_bias": false,
    "allow_entry_without_mss": false
  }
}
```

---

### 2.8 Enforcement & Resets

**Chart TF Change**:
```csharp
public void OnChartTimeframeChanged(TimeFrame newTf)
{
    _logger.Info($"Chart TF changed to {newTf}, resetting bias state machine");

    // 1. Switch HTF set
    var (primary, secondary) = _htfMapper.GetHtfSet(newTf);
    _htfPrimary = _marketData.GetSeries(_symbol, primary);
    _htfSecondary = _marketData.GetSeries(_symbol, secondary);

    // 2. Reset state
    _biasStateMachine.Reset();

    // 3. Recompute references
    _liquidityRefs.Clear();
    _liquidityRefs.Add(ComputePDH());
    _liquidityRefs.Add(ComputePDL());
    _liquidityRefs.Add(ComputeAsiaH());
    _liquidityRefs.Add(ComputeAsiaL());
    _liquidityRefs.AddRange(ComputeHtfLevels(primary));
    _liquidityRefs.AddRange(ComputeHtfLevels(secondary));

    // 4. Emit reset event
    EmitEvent("tf_change_reset", newTf.ToString());
}
```

**Candidate Timeout**:
```csharp
public void CheckCandidateTimeout(DateTime serverTime)
{
    if (_state != BiasState.CANDIDATE) return;

    int confirmWindowMin = 300; // 5 hours
    TimeSpan elapsed = serverTime - _candidateTime;

    if (elapsed.TotalMinutes > confirmWindowMin)
    {
        _logger.Debug($"Candidate timeout: {elapsed.TotalMinutes:F0} min > {confirmWindowMin} min");
        EmitEvent("bias_invalidated", _candidateBias.ToString(), "timeout");
        Reset();
    }
}
```

---

## Part 3: Implementation Roadmap

### Phase 1: Immediate Fix (TODAY)

**Task**: Fix entryDir=Neutral blocking issue

**Files**:
- [JadecapStrategy.cs:2601](JadecapStrategy.cs#L2601)

**Steps**:
1. Apply entryDir fix from [SEQUENCEGATE_BLOCKING_ALL_ENTRIES_FIX.md](SEQUENCEGATE_BLOCKING_ALL_ENTRIES_FIX.md)
2. Add enhanced logging
3. Rebuild
4. Retest Sep 18-25 backtest
5. Compare results (before/after)

**Expected Result**:
- entryDir = Bullish/Bearish (not Neutral)
- SequenceGate passes when valid MSS exists
- 1-4 entries per day

**Time**: 1 hour

---

### Phase 2: HTF-Aware System (FUTURE)

**Task**: Replace bias/sweep modules with new HTF-aware system

**New Files**:
- `BiasStateMachine.cs` (state machine logic)
- `HtfMapper.cs` (auto TF mapping)
- `LiquidityReferenceManager.cs` (HTF reference levels)
- `EventEmitter.cs` (JSON event emission)

**Modified Files**:
- `Data_MarketDataProvider.cs` (integrate state machine)
- `Signals_LiquiditySweepDetector.cs` (replace with state machine sweep detection)
- `Signals_MSSignalDetector.cs` (add gate check)
- `JadecapStrategy.cs` (integrate gates in BuildTradeSignal)

**Steps**:
1. Design class structure
2. Implement BiasStateMachine
3. Implement HtfMapper
4. Implement LiquidityReferenceManager
5. Integrate gates in MSS/OTE/Entry
6. Add JSON event emission
7. Test with multiple chart TFs (5m, 15m)
8. Backtest comparison (old vs new system)

**Time**: 2-3 days

---

## Part 4: Migration Strategy

**Option A: Parallel Implementation** (RECOMMENDED)
- Keep existing bias/sweep modules active
- Add new system alongside (disabled by default)
- Use config flag to switch: `"use_htf_orchestrated_bias": false`
- Test new system extensively before deprecating old

**Option B: Direct Replacement** (RISKY)
- Remove existing modules immediately
- Implement new system only
- Faster but higher risk if bugs exist

**Recommendation**: Option A with gradual migration:
1. Phase 1: Fix immediate entryDir issue (existing system)
2. Phase 2: Build new HTF system (parallel, disabled)
3. Phase 3: A/B test both systems (backtests)
4. Phase 4: Enable new system if performance better
5. Phase 5: Deprecate old modules

---

## Part 5: Testing Requirements

### Unit Tests (New System)

1. **HtfMapper**
   - Test 5m → (15m, 1H)
   - Test 15m → (4H, 1D)
   - Test unsupported TF throws exception

2. **BiasStateMachine**
   - Test IDLE → CANDIDATE (sweep detection)
   - Test CANDIDATE → CONFIRMED_BIAS (confirmation)
   - Test CONFIRMED_BIAS → READY_FOR_MSS (gate open)
   - Test ANY → INVALIDATED (opposite sweep)
   - Test candidate timeout reset

3. **LiquidityReferenceManager**
   - Test PDH/PDL computation
   - Test Asia H/L computation
   - Test HTF H/L computation (4H, 1D, 15m, 1H)
   - Test reference refresh on TF change

### Integration Tests

1. **Sep 18-25 Backtest (5m chart)**
   - Compare: Old system vs New system
   - Metrics: Entries, Win rate, RR, Drawdown

2. **Sep 18-25 Backtest (15m chart)**
   - Verify HTF auto-switches to 4H/1D
   - Compare results to 5m chart

3. **Live Test (1 week)**
   - Monitor gate events
   - Verify no premature MSS/Entry execution
   - Check event JSON validity

---

## Part 6: Decision Point

**User, you need to choose**:

**A)** Apply Phase 1 fix NOW (entryDir=Neutral) → Retest → Then decide on Phase 2

**B)** Skip Phase 1, implement full Phase 2 HTF system now (2-3 days work)

**C)** Apply Phase 1 fix, then schedule Phase 2 for later (after Phase 1 results proven)

**My Recommendation**: **Option A**
- Fix immediate blocker (0 entries)
- Prove fix works with Sep 18-25 retest
- Then decide if Phase 2 HTF system is needed based on results

---

**Created**: October 24, 2025 at 9:50 PM
**Status**: Awaiting user decision on Phase 1 vs Phase 2
**Next**: Implement chosen approach
