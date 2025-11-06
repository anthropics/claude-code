# HTF Bias/Sweep System - Integration Guide

**Date**: October 24, 2025
**Status**: READY TO INTEGRATE
**Files Created**: 7 new orchestration classes

---

## Files Created ✅

**New Classes** (in `Orchestration/` folder):
1. ✅ `HtfMapper.cs` - Auto timeframe mapping
2. ✅ `HtfDataProvider.cs` - HTF OHLC provider (no repaint)
3. ✅ `LiquidityReferenceManager.cs` - HTF level computation
4. ✅ `BiasStateMachine.cs` - State machine (900+ lines)
5. ✅ `OrchestratorGate.cs` - Gate enforcement + JSON events
6. ✅ `CompatibilityValidator.cs` - Self-validation

---

## Integration Steps

### Step 1: Add Private Fields to JadecapStrategy.cs

**Location**: After line ~480 (where detectors are declared)

```csharp
// ═══════════════════════════════════════════════════════════════════
// HTF BIAS/SWEEP ORCHESTRATION (NEW)
// ═══════════════════════════════════════════════════════════════════

private HtfMapper _htfMapper;
private HtfDataProvider _htfDataProvider;
private LiquidityReferenceManager _liquidityRefManager;
private BiasStateMachine _biasStateMachine;
private OrchestratorGate _orchestratorGate;
private CompatibilityValidator _compatibilityValidator;

private bool _htfSystemEnabled = false;  // Toggle: false = use old system, true = use new HTF system
private TimeFrame _htfPrimary;
private TimeFrame _htfSecondary;
```

---

### Step 2: Initialize in OnStart()

**Location**: In `OnStart()` method, after existing detector initialization (~line 1200)

```csharp
// ═══════════════════════════════════════════════════════════════════
// INITIALIZE HTF BIAS/SWEEP SYSTEM
// ═══════════════════════════════════════════════════════════════════

try
{
    Print("[HTF SYSTEM] Initializing HTF Bias/Sweep orchestration...");

    // 1. Create mapper
    _htfMapper = new HtfMapper();

    // 2. Check if chart TF supported
    if (!_htfMapper.IsSupported(this.TimeFrame))
    {
        Print($"[HTF SYSTEM] WARNING: Chart TF {this.TimeFrame} not supported. Use 5m or 15m. HTF system DISABLED.");
        _htfSystemEnabled = false;
    }
    else
    {
        // 3. Get HTF pair
        var (primary, secondary) = _htfMapper.GetHtfPair(this.TimeFrame);
        _htfPrimary = primary;
        _htfSecondary = secondary;
        Print($"[HTF SYSTEM] Chart TF: {this.TimeFrame} → HTF: {primary}/{secondary}");

        // 4. Create HTF data provider
        _htfDataProvider = new HtfDataProvider(this, Symbol, MarketData);

        // 5. Create reference manager
        _liquidityRefManager = new LiquidityReferenceManager(this, Symbol, _htfDataProvider, _htfMapper);

        // 6. Create orchestrator gate
        string eventLogPath = System.IO.Path.Combine(
            System.IO.Path.GetDirectoryName(_journal.GetLogPath()),
            "orchestrator_events.jsonl"
        );
        _orchestratorGate = new OrchestratorGate(this, _config, eventLogPath);

        // 7. Create compatibility validator
        _compatibilityValidator = new CompatibilityValidator(this);

        // 8. Run compatibility check
        bool compatible = _compatibilityValidator.ValidateAll(
            _orchestratorGate,
            _htfMapper,
            _htfDataProvider,
            _liquidityRefManager,
            this.TimeFrame
        );

        Print(_compatibilityValidator.GetValidationReport());

        if (!compatible)
        {
            Print("[HTF SYSTEM] COMPATIBILITY CHECK FAILED - HTF system DISABLED");
            _htfSystemEnabled = false;

            // Emit compatibility error
            _orchestratorGate.EmitCompatibilityReport("error",
                _compatibilityValidator.GetFailedChecks().Select(c => c.Message).ToList());
        }
        else
        {
            // 9. Create state machine
            _biasStateMachine = new BiasStateMachine(
                this,
                Symbol,
                _htfDataProvider,
                _liquidityRefManager,
                _orchestratorGate,
                _config
            );
            _biasStateMachine.Initialize(_htfPrimary, _htfSecondary);

            // 10. Perform handshake
            _orchestratorGate.PerformHandshake(
                version: "2.0.0",
                tfMapChecksum: $"{this.TimeFrame}→{primary}/{secondary}",
                thresholdsChecksum: "default"
            );

            _htfSystemEnabled = true;
            Print("[HTF SYSTEM] ✓ ENABLED - State machine active, gates enforced");
        }
    }
}
catch (Exception ex)
{
    Print($"[HTF SYSTEM] INITIALIZATION ERROR: {ex.Message}");
    Print($"[HTF SYSTEM] Stack: {ex.StackTrace}");
    _htfSystemEnabled = false;
}
```

---

### Step 3: Update OnBar() to Call State Machine

**Location**: In `OnBar()` method, BEFORE existing sweep/bias detection (~line 1575)

```csharp
// ═══════════════════════════════════════════════════════════════════
// HTF BIAS/SWEEP STATE MACHINE UPDATE
// ═══════════════════════════════════════════════════════════════════

if (_htfSystemEnabled && _biasStateMachine != null)
{
    _biasStateMachine.OnBar();
}
```

---

### Step 4: Replace GetCurrentBias() Calls

**Option A: Use State Machine Bias** (if HTF system enabled)

**Location**: Line ~1580 where bias is fetched

```csharp
// OLD:
// var bias = _marketData.GetCurrentBias();

// NEW:
BiasDirection bias;
if (_htfSystemEnabled && _biasStateMachine != null)
{
    // Use confirmed bias from state machine
    bias = _biasStateMachine.GetConfirmedBias() ?? BiasDirection.Neutral;

    if (_config.EnableDebugLogging)
        Print($"[HTF BIAS] Using state machine bias: {bias} (state={_biasStateMachine.GetState()})");
}
else
{
    // Fallback to old system
    bias = _marketData.GetCurrentBias();
}
```

---

### Step 5: Add Gate Check to MSS Detection

**Location**: In `Signals_MSSignalDetector.cs` DetectMSS() method, at the very beginning

```csharp
public List<MSSSignal> DetectMSS(...)
{
    // NEW: Gate check
    if (_htfSystemEnabled && _biasStateMachine != null)
    {
        if (!_biasStateMachine.IsMssAllowed())
        {
            if (_config.EnableDebugLogging)
                _journal.Debug($"MSS: BLOCKED by bias gate (state={_biasStateMachine.GetState()})");
            return new List<MSSSignal>();
        }
    }

    // Existing MSS detection logic...
}
```

**Problem**: MSS detector doesn't have access to bias state machine.

**Solution**: Pass state machine reference in constructor:

```csharp
// In MSSignalDetector.cs constructor:
private BiasStateMachine _biasStateMachine;

public MSSignalDetector(
    Robot bot,
    StrategyConfig config,
    MarketDataProvider marketData,
    BiasStateMachine biasStateMachine = null)  // NEW parameter
{
    _bot = bot;
    _config = config;
    _marketData = marketData;
    _biasStateMachine = biasStateMachine;  // NEW
}
```

**Then in JadecapStrategy.cs OnStart():**

```csharp
// OLD:
// _mssDetector = new MSSignalDetector(this, _config, _marketData);

// NEW:
_mssDetector = new MSSignalDetector(this, _config, _marketData, _biasStateMachine);
```

---

### Step 6: Fix entryDir=Neutral Issue (from previous analysis)

**Location**: Line ~2601 in BuildTradeSignal() method

```csharp
// OLD:
// var entryDir = lastMss != null ? lastMss.Direction : bias;

// NEW:
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

// NEW: If HTF system enabled, prefer confirmed bias over Neutral
if (_htfSystemEnabled && _biasStateMachine != null && entryDir == BiasDirection.Neutral)
{
    var confirmedBias = _biasStateMachine.GetConfirmedBias();
    if (confirmedBias.HasValue)
    {
        entryDir = confirmedBias.Value;
        if (_config.EnableDebugLogging)
            _journal.Debug($"BuildSignal: Using HTF confirmed bias: {entryDir}");
    }
}
```

---

### Step 7: Add HTF System Toggle Parameter

**Location**: Add parameter at top of JadecapStrategy.cs (with other parameters ~line 50)

```csharp
[Parameter("Enable HTF Orchestrated Bias/Sweep", Group = "HTF System", DefaultValue = false)]
public bool EnableHtfOrchestratedSystem { get; set; }
```

**Then in OnStart(), use this parameter:**

```csharp
// At start of HTF system initialization:
if (!EnableHtfOrchestratedSystem)
{
    Print("[HTF SYSTEM] Disabled by parameter. Using legacy bias/sweep.");
    _htfSystemEnabled = false;
    return; // Skip HTF initialization
}
```

---

## Build & Test Steps

### 1. Update .csproj File

**Location**: `CCTTB.csproj`

Add new files to compilation:

```xml
<ItemGroup>
  <!-- Existing files... -->

  <!-- HTF Orchestration System -->
  <Compile Include="Orchestration\HtfMapper.cs" />
  <Compile Include="Orchestration\HtfDataProvider.cs" />
  <Compile Include="Orchestration\LiquidityReferenceManager.cs" />
  <Compile Include="Orchestration\BiasStateMachine.cs" />
  <Compile Include="Orchestration\OrchestratorGate.cs" />
  <Compile Include="Orchestration\CompatibilityValidator.cs" />
</ItemGroup>
```

### 2. Build

```bash
cd C:\Users\Administrator\Documents\cAlgo\Sources\Robots\CCTTB\CCTTB
dotnet build --configuration Debug
```

**Expected**: 0 errors, 0 warnings

### 3. Initial Test (HTF System Disabled)

1. Load bot on cTrader (EURUSD M5 or M15)
2. Set `Enable HTF Orchestrated Bias/Sweep` = **FALSE**
3. Run for 1 hour
4. Verify old system still works

### 4. Enable HTF System Test

1. Set `Enable HTF Orchestrated Bias/Sweep` = **TRUE**
2. Check Log tab for:
   ```
   [HTF SYSTEM] Initializing...
   [HTF SYSTEM] Chart TF: Minute5 → HTF: Minute15/Hour
   ╔════════════════════════════════════════════════════════════╗
   ║       HTF BIAS/SWEEP ENGINE - COMPATIBILITY REPORT       ║
   ╚════════════════════════════════════════════════════════════╝
   ✓ PASS | OrchestratorGate
   ✓ PASS | HtfMapper
   ✓ PASS | HtfDataProvider
   ✓ PASS | LiquidityReferenceManager
   ✓ PASS | ChartTimeframe
   Overall Status: ✓ COMPATIBLE - Engine Ready
   [HTF SYSTEM] ✓ ENABLED - State machine active, gates enforced
   ```

3. Wait for liquidity sweep
4. Check for bias candidate:
   ```
   [BiasStateMachine] IDLE → CANDIDATE (BUY) | Sweep: PDL @ 1.05234
   ```

5. Wait for confirmation:
   ```
   [BiasStateMachine] CANDIDATE → CONFIRMED_BIAS (Bullish) | Metric: close>DO, Confidence: High
   [BiasStateMachine] CONFIRMED_BIAS → READY_FOR_MSS | Gate OPEN for MSS
   [OrchestratorGate] Gate MSS OPENED (reason: bias_confirmed)
   ```

6. Check for MSS detection:
   ```
   MSS: Bullish structure break detected
   ```

7. Check for entry execution

### 5. Check JSON Event Log

**Location**: `C:\Users\Administrator\Documents\cAlgo\Data\cBots\CCTTB\data\logs\orchestrator_events.jsonl`

**Expected Events**:
```json
{"event":"handshake_request","timestamp":"2025-10-24T21:00:00Z","module":"BiasSweepEngine","version":"2.0.0"...}
{"event":"liquidity_sweep_detected","timestamp":"2025-10-24T21:05:00Z","dir":"down","ref":"PDL"...}
{"event":"bias_candidate_set","timestamp":"2025-10-24T21:05:00Z","candidate":"BUY"...}
{"event":"bias_confirmed","timestamp":"2025-10-24T21:10:00Z","bias":"BUY","confidence":"high"...}
{"event":"gate_open","timestamp":"2025-10-24T21:10:00Z","module":"MSS","reason":"bias_confirmed"}
```

---

## Testing Matrix

### Test 1: M5 Chart with HTF System

**Setup**:
- Chart: EURUSD M5
- HTF: 15m + 1H (auto-selected)
- HTF System: ENABLED

**Expected Behavior**:
1. Wait for sweep at PDH/PDL/Asia/15m_H/15m_L/1H_H/1H_L
2. Candidate set (BUY or SELL)
3. Wait for close > DO or close > Asia_H (BUY) / close < DO or close < Asia_L (SELL)
4. Bias confirmed → Gate opens
5. MSS detection allowed
6. Entry executed

### Test 2: M15 Chart with HTF System

**Setup**:
- Chart: EURUSD M15
- HTF: 4H + 1D (auto-selected)
- HTF System: ENABLED

**Expected Behavior**:
- Same flow as Test 1
- HTF references: 4H_H/L, 1D_H/L, Prev_4H_H/L, Prev_1D_H/L

### Test 3: Compare Old vs New System

**Backtest Sep 18-25, 2025**:

**Run A** (Old System):
- HTF System: DISABLED
- Record: Entries, Win rate, RR, Drawdown

**Run B** (New System):
- HTF System: ENABLED
- Record: Same metrics

**Compare**:
- Entries: New should have FEWER (higher quality filter)
- Win Rate: New should be HIGHER (better bias confirmation)
- Avg RR: New should be similar or better
- Drawdown: New should be LOWER (fewer losing trades)

---

## Troubleshooting

### Issue: "HTF data missing or insufficient bars"

**Cause**: Not enough HTF bars loaded

**Solution**:
1. Let bot run for 1-2 HTF candles first
2. Or start bot after market has been open for 1 HTF period

### Issue: "MSS: BLOCKED by bias gate"

**Cause**: State machine not yet at READY_FOR_MSS

**Solution**: This is CORRECT behavior. Wait for:
1. Liquidity sweep
2. Bias confirmation
3. Gate opens → MSS allowed

### Issue: "BuildSignal: HTF bias Neutral"

**Cause**: No confirmed bias yet, state = IDLE or CANDIDATE

**Solution**:
- Check state machine logs
- Verify sweep detection is working
- Check confirmation metrics (close > DO, etc.)

### Issue: Compilation errors

**Cause**: Missing `using` statements or class references

**Solution**:
```csharp
using System;
using System.Collections.Generic;
using System.Linq;
using System.Text.Json;
using cAlgo.API;
```

---

## Rollback Plan

If HTF system causes issues:

**Step 1**: Set `Enable HTF Orchestrated Bias/Sweep` = **FALSE**

**Step 2**: Verify old system resumes working

**Step 3**: Check logs for specific error

**Step 4**: Report issue with:
- Chart TF
- Error message
- Log snippet
- Expected vs actual behavior

---

## Next Steps After Integration

1. ✅ Build successfully
2. ✅ Test with HTF disabled (verify old system)
3. ✅ Test with HTF enabled (verify compatibility report)
4. ✅ Wait for first sweep → candidate → confirmation → gate open
5. ✅ Verify MSS detection allowed after gate open
6. ✅ Check JSON event log for proper event sequence
7. ✅ Run Sep 18-25 backtest comparison (old vs new)
8. ✅ Analyze results and decide on default setting

---

**Created**: October 24, 2025 at 10:15 PM
**Status**: Ready for integration
**Estimated Time**: 30-45 minutes
**Risk Level**: Low (toggle parameter allows easy rollback)
