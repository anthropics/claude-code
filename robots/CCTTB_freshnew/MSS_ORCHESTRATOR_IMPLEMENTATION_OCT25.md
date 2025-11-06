# MSS Orchestrator Implementation (Oct 25, 2025)

## Executive Summary

**Status**: ⏳ IN PROGRESS - Core implementation complete, data structure alignment needed
**Impact**: 🟡 MODERATE - Dual-timeframe MSS system (15M bias → 5M entry)
**User Request**: Complete MSS × Orchestrator/Preset/Policy Integration per specification

## What Was Implemented

### 1. HTF_MSS_Detector (15M Detector)

**File**: `Orchestration/HTF_MSS_Detector.cs` (405 lines)

**Core Functionality**:
- Detects 15M Market Structure Shifts after liquidity sweeps
- Validates displacement strength (ATR-based)
- Identifies HTF POI (Order Blocks, FVGs)
- Emits HTF_MSS events with complete context

**Key Methods**:
```csharp
public HTF_MSSEvent DetectHTF_MSS()
{
    // Step 1: Check for recent sweep (last 10 candles)
    // Step 2: Detect MSS with displacement
    // Step 3: Validate structure break (min 10 pips)
    // Step 4: Identify HTF POI
    // Step 5: Calculate displacement metrics
    // Step 6: Create HTF_MSS event
}
```

**Event Structure**:
```csharp
public class HTF_MSSEvent
{
    string Side;                    // Bullish/Bearish
    HTFPOI HTFPOI;                 // Order Block zone
    string SweepRef;                // Reference to swept level
    DisplacementData Displacement;  // ATR metrics
    StructBreak StructBreak;        // Break validation
    DateTime ValidUntil;            // 5-hour window (20 candles)
}
```

### 2. LTF_MSS_Detector (5M Detector)

**File**: `Orchestration/LTF_MSS_Detector.cs` (483 lines)

**Core Functionality**:
- Receives HTF context from orchestrator
- Waits for 5M MSS aligned with HTF direction
- Validates OTE pullback (0.618-0.79 retracement)
- Confirms entry inside HTF POI
- Calculates entry, SL, TP parameters

**Key Methods**:
```csharp
public void SetHTFContext(HTF_MSSEvent htfEvent)
{
    // Store HTF context and open validation window
}

public LTF_ConfirmEvent DetectLTF_Confirmation()
{
    // Step 1: Detect LTF MSS aligned with HTF
    // Step 2: Check for OTE pullback
    // Step 3: Identify LTF POI
    // Step 4: Validate entry inside HTF POI
    // Step 5: Calculate entry parameters (SL/TP)
    // Step 6: Create LTF_CONFIRM event
}
```

**Validation**:
- Entry must be inside HTF POI zone
- Minimum RR: 1.5:1
- Stop Loss: 5 pips below/above LTF POI
- Take Profit: HTF structure break level + 2× SL distance

### 3. MSSOrchestrator Enhancements

**File**: `Orchestration/MSSOrchestrator.cs` (Updated)

**Added Classes**:
```csharp
public class LTFPOI
{
    public double Top { get; set; }
    public double Bottom { get; set; }
    public string Type { get; set; }  // "OrderBlock" | "OTEZone"
}
```

**State Machine**:
```
Idle → HTF_AwaitLTF → ReadyToFire → InTrade → Cooldown
```

**Orchestration Flow**:
1. HTF_MSS_Detector emits 15M signal → MSSOrchestrator.OnHTFMSS()
2. Orchestrator opens 5-hour validation window
3. LTF_MSS_Detector checks for 5M confirmation
4. On confirmation → MSSOrchestrator.OnLTFConfirm()
5. Multi-factor scoring (6 factors, 0-100 scale)
6. Policy gate validation
7. State → ReadyToFire (entry allowed)

### 4. Policy Configuration

**File**: `config/runtime/policy.json` (Updated)

**New Section**: `mssOrchestrator` (160 lines of configuration)

**Key Settings**:
```json
{
  "enabled": true,
  "htf": {
    "timeframe": "15M",
    "minDisplacementATR": 1.5,
    "minStructBreakPips": 10,
    "windowCandles": 20
  },
  "ltf": {
    "timeframe": "5M",
    "minDisplacementATR": 1.0,
    "oteRange": { "min": 0.618, "max": 0.79 },
    "minRiskReward": 1.5,
    "requireInsideHTF_POI": true
  },
  "scoring": {
    "factors": {
      "displacement": { "weight": 30 },
      "alignment": { "weight": 20 },
      "poiQuality": { "weight": 20 },
      "insideHTF_POI": { "weight": 10 },
      "freshness": { "weight": 10 },
      "structure": { "weight": 10 }
    },
    "minTotalScore": 50
  }
}
```

### 5. JadecapStrategy Integration

**File**: `JadecapStrategy.cs` (Lines 614-618, 1345-1370, 1117-1149)

**Added Fields**:
```csharp
private MSSOrchestrator _mssOrchestrator;
private HTF_MSS_Detector _htfMssDetector;
private LTF_MSS_Detector _ltfMssDetector;
private bool _useMSSOrchestrator = false; // Enable flag
```

**Initialization** (OnStart):
```csharp
if (_useMSSOrchestrator)
{
    var mssPolicy = LoadMSSPolicy();
    _mssOrchestrator = new MSSOrchestrator(this, Symbol, mssPolicy);
    _htfMssDetector = new HTF_MSS_Detector(...);
    _ltfMssDetector = new LTF_MSS_Detector(...);
}
```

**Helper Method**:
```csharp
private MSSPolicyConfig LoadMSSPolicy()
{
    // Loads MSS configuration from policy.json
    // Currently using default values (can be extended to read JSON)
}
```

## Known Issues & Required Fixes

### Data Structure Misalignment

**Issue**: Property name mismatches between detector usage and MSS Orchestrator class definitions

**Errors**:
1. `HTFPOI.Top/Bottom` → Should be `HTFPOI.PriceTop/PriceBottom` ✅ FIXED
2. `DisplacementData.Size/ATRMultiple/HasFVG/FVGSize` → Should be `BodyFactor/GapSize/ATRz`
3. `StructBreak.Level/Distance/DistancePips` → Should be `BreakLevel/ClosePrice/BrokenRef`
4. `MSSPolicyConfig.HTFConfig` properties don't match usage

**Current Compiler Errors**: 26 errors, 3 warnings

**Fix Required**:
1. Update `MSSOrchestrator.DisplacementData` class to include:
   - `Size` → Add or rename from `BodyFactor`
   - `ATRMultiple` → Add or calculate from `ATRz`
   - `HasFVG` → Add boolean
   - `FVGSize` → Add or rename from `GapSize`

2. Update `MSSOrchestrator.StructBreak` class to include:
   - `Level` → Add or rename from `BreakLevel`
   - `Distance` → Add (distance in price)
   - `DistancePips` → Add (distance in pips)

3. Fix `LoadMSSPolicy()` method in JadecapStrategy to use correct property names:
   - `MinDisplacementATR` → Should be `MinDispBodyFactor`
   - `MinStructBreakPips` → Not in original HTFConfig
   - `MinRR` → Not in original LTFConfig
   - Add `CooldownsConfig` class structure

## Integration Points (To Be Completed)

### OnBar Integration

**Where**: JadecapStrategy.OnBar() method

**Code to Add**:
```csharp
// MSS Orchestrator update
if (_useMSSOrchestrator && _mssOrchestrator != null)
{
    _mssOrchestrator.Update(); // Check timers and state transitions

    // Check for HTF MSS on 15M timeframe
    if (Chart.TimeFrame == TimeFrame.Minute15)
    {
        var htfEvent = _htfMssDetector.DetectHTF_MSS();
        if (htfEvent != null)
        {
            _mssOrchestrator.OnHTFMSS(
                htfEvent.Side,
                htfEvent.HTFPOI,
                htfEvent.SweepRef,
                htfEvent.Displacement,
                htfEvent.StructBreak
            );

            // Set HTF context for LTF detector
            _ltfMssDetector.SetHTFContext(htfEvent);
        }
    }

    // Check for LTF confirmation on 5M timeframe
    if (Chart.TimeFrame == TimeFrame.Minute5)
    {
        var ltfEvent = _ltfMssDetector.DetectLTF_Confirmation();
        if (ltfEvent != null)
        {
            bool confirmed = _mssOrchestrator.OnLTFConfirm(
                ltfEvent.Side,
                ltfEvent.EntryPrice,
                ltfEvent.StopLoss,
                ltfEvent.TakeProfit
            );

            if (confirmed && _mssOrchestrator.IsReadyToFire())
            {
                // Execute trade through existing trade manager
                // Use ltfEvent.EntryPrice, StopLoss, TakeProfit
            }
        }
    }
}
```

### Trade Lifecycle Integration

**OnPositionClosed**:
```csharp
if (_useMSSOrchestrator && _mssOrchestrator != null)
{
    bool wasWinner = (closedPosition.NetProfit > 0);
    _mssOrchestrator.OnTradeClosed(wasWinner);
    _ltfMssDetector.ClearHTFContext();
}
```

## Benefits When Complete

1. **Dual-Timeframe Validation**: 15M bias confirmed by 5M entry
2. **Quality Control**: Multi-factor scoring ensures high-probability setups
3. **Proper ICT Flow**: HTF sweep → HTF MSS → LTF pullback → LTF entry
4. **Risk Management**: Minimum 1.5:1 RR, stop loss properly placed
5. **Adaptive Windows**: 5-hour validation window for LTF confirmation
6. **State Management**: Clear state machine prevents overtrading

## Next Steps

1. **Fix Data Structures**: Align property names between detectors and MSSOrchestrator
2. **Complete LoadMSSPolicy()**: Read from JSON or use correct default property names
3. **Build Verification**: Ensure 0 errors, 0 warnings
4. **OnBar Integration**: Add orchestrator calls to main trading loop
5. **Testing**: Backtest on Sep 18 - Oct 1, 2025 period

## Files Modified

- **Created**:
  - `Orchestration/HTF_MSS_Detector.cs` (405 lines)
  - `Orchestration/LTF_MSS_Detector.cs` (483 lines)
  - `MSS_ORCHESTRATOR_IMPLEMENTATION_OCT25.md` (this file)

- **Updated**:
  - `Orchestration/MSSOrchestrator.cs` - Added LTFPOI class
  - `JadecapStrategy.cs` - Added MSS orchestrator fields, initialization, LoadMSSPolicy()
  - `config/runtime/policy.json` - Added mssOrchestrator configuration section

## Deployment Status

🟡 **PARTIAL** - Core detectors implemented, data structure alignment needed before build succeeds

**Enable When Ready**:
```csharp
private bool _useMSSOrchestrator = true; // Change from false to true
```

---

**Status**: Implementation 80% complete
**Blocking**: Data structure property name alignment
**ETA**: 30 minutes to complete fixes and testing
**Priority**: 🟡 P1 - Advanced feature (not blocking core trading)
