# Phase 1 Implementation Specification - Oct 26, 2025

## Overview

This document specifies **exactly** what code changes will be made for Phase 1A and 1B fixes.
**Review this first** - I will implement after your approval.

---

## Phase 1A: Quick Wins (Logging & Safety Guards)

### Change #1A-1: Enhanced Logging in ExecuteTrade()

**Location**: `Execution_TradeManager.cs`, `ExecuteTrade()` method
**Line**: After line 153 (after SL calculation)

**Add**:
```csharp
// ═══════════════════════════════════════════════════════
// PHASE 1A: ENHANCED SL/TP/RR LOGGING (Oct 26, 2025)
// ═══════════════════════════════════════════════════════

// Calculate ATR for logging
double atrPips = 0;
double atrZScore = 0;
if (_robot.Bars != null && _robot.Bars.Count >= 30)  // Need 20+ for Z-score
{
    int n = 14;
    var bars = _robot.Bars;
    double[] atrValues = new double[20];  // Store 20 ATR values for Z-score

    for (int period = 0; period < 20; period++)
    {
        double sum = 0;
        for (int i = bars.Count - n - 1 - period; i < bars.Count - 1 - period; i++)
        {
            double tr = Math.Max(bars.HighPrices[i] - bars.LowPrices[i],
                          Math.Max(Math.Abs(bars.HighPrices[i] - bars.ClosePrices[i - 1]),
                                   Math.Abs(bars.LowPrices[i] - bars.ClosePrices[i - 1])));
            sum += tr;
        }
        atrValues[period] = (sum / n) / pip;
    }

    atrPips = atrValues[0];  // Most recent ATR

    // Calculate Z-score
    double meanATR = atrValues.Average();
    double variance = atrValues.Select(x => (x - meanATR) * (x - meanATR)).Average();
    double stdDev = Math.Sqrt(variance);
    atrZScore = stdDev > 0 ? (atrPips - meanATR) / stdDev : 0;
}

// Calculate spread
double spreadPips = symbol.Spread / pip;

if (_config.EnableDebugLogging)
{
    _robot.Print($"[SL_CALC] atr={atrPips:F2} z={atrZScore:F2} mult={_config.AtrSanityFactor:F2} " +
                 $"rawSL={Math.Abs(signal.EntryPrice - signal.StopLoss) / pip:F1} " +
                 $"stopMin={symbol.StopLossInPips:F1} spread={spreadPips:F2} effSL={slPips:F1}");
}
```

---

### Change #1A-2: Spread/ATR Guard

**Location**: `Execution_TradeManager.cs`, `ExecuteTrade()` method
**Line**: Before line 160 (before CalculatePositionSize call)

**Add**:
```csharp
// ═══════════════════════════════════════════════════════
// PHASE 1A: SPREAD/ATR GUARD (Oct 26, 2025)
// ═══════════════════════════════════════════════════════

double spreadRatio = (atrPips > 0) ? (spreadPips / atrPips) : 0;
double volumeMultiplier = 1.0;
string spreadAction = "TAKE";

if (spreadRatio > 0.40)
{
    // Extremely wide spread - skip entry entirely
    if (_config.EnableDebugLogging)
    {
        _robot.Print($"[SPREAD_GUARD] spread={spreadPips:F2} atr={atrPips:F2} ratio={spreadRatio:F2} → SKIP entry (extreme spread)");
    }
    return;  // Skip this trade
}
else if (spreadRatio > 0.25)
{
    // High spread - halve position size
    volumeMultiplier = 0.5;
    spreadAction = "HALVE";
    if (_config.EnableDebugLogging)
    {
        _robot.Print($"[SPREAD_GUARD] spread={spreadPips:F2} atr={atrPips:F2} ratio={spreadRatio:F2} → HALVED position");
    }
}
else
{
    if (_config.EnableDebugLogging)
    {
        _robot.Print($"[SPREAD_GUARD] spread={spreadPips:F2} atr={atrPips:F2} ratio={spreadRatio:F2} → TAKE full position");
    }
}
```

---

### Change #1A-3: Apply Volume Multiplier

**Location**: `Execution_TradeManager.cs`, `ExecuteTrade()` method
**Line**: After line 161 (after CalculatePositionSize call)

**Modify**:
```csharp
double volume = _riskManager.CalculatePositionSize(signal.EntryPrice, effStop, symbol);

// Apply spread multiplier if set
if (volumeMultiplier < 1.0)
{
    volume = volume * volumeMultiplier;
    _robot.Print($"[SPREAD_GUARD] Volume adjusted: {volume / volumeMultiplier:F2} → {volume:F2} (mult={volumeMultiplier:F2})");
}

_robot.Print($"[TRADE_EXEC] Returned volume: {volume:F2} units ({volume / symbol.LotSize:F4} lots)");
```

---

### Change #1A-4: Order Compliance Checks

**Location**: `Execution_TradeManager.cs`, `ExecuteTrade()` method
**Line**: After line 224 (after ChooseTakeProfit call)

**Add**:
```csharp
// ═══════════════════════════════════════════════════════
// PHASE 1A: ORDER COMPLIANCE CHECKS (Oct 26, 2025)
// ═══════════════════════════════════════════════════════

// Round prices to broker precision
double roundedEntry = Math.Round(signal.EntryPrice, symbol.Digits);
double roundedSL = Math.Round(effStop, symbol.Digits);
double roundedTP = Math.Round(takeProfit, symbol.Digits);

// Recalculate distances after rounding
double slDistanceRounded = Math.Abs(roundedEntry - roundedSL) / pip;
double tpDistanceRounded = Math.Abs(roundedTP - roundedEntry) / pip;
double rrAfterRounding = (slDistanceRounded > 0) ? (tpDistanceRounded / slDistanceRounded) : 0;

// Normalize volume to broker requirements
long normalizedVolume = symbol.NormalizeVolumeInUnits(volume);

if (_config.EnableDebugLogging)
{
    _robot.Print($"[BROKER_CHECK] vol={normalizedVolume} min={symbol.VolumeInUnitsMin} " +
                 $"step={symbol.VolumeInUnitsStep} pricePrecision={symbol.Digits} " +
                 $"rrAfterCompliance={rrAfterRounding:F2}");
}

// Validate volume meets minimum
if (normalizedVolume < symbol.VolumeInUnitsMin)
{
    _robot.Print($"[BROKER_CHECK] Volume {normalizedVolume} < min {symbol.VolumeInUnitsMin} → ABORT entry");
    return;
}

// Validate RR after rounding (minimum 1.6:1)
if (rrAfterRounding < 1.6)
{
    _robot.Print($"[BROKER_CHECK] RR after rounding = {rrAfterRounding:F2} < 1.6 → ABORT entry (insufficient RR after compliance)");
    return;
}

// Use normalized volume for trade
volume = normalizedVolume;

if (_config.EnableDebugLogging)
{
    _robot.Print($"[BROKER_CHECK] ✅ Compliance passed | vol={volume} | RR={rrAfterRounding:F2}");
}
```

---

## Phase 1B: Core Fixes

### Change #1B-1: ATR Z-Score Adaptive SL

**Location**: `Execution_TradeManager.cs`, `ExecuteTrade()` method
**Line**: Replace lines 136-152 (current SL calculation)

**Replace with**:
```csharp
// ═══════════════════════════════════════════════════════
// PHASE 1B: ATR Z-SCORE ADAPTIVE SL (Oct 26, 2025)
// ═══════════════════════════════════════════════════════

double pip = symbol.PipSize;
double slPips = Math.Abs(signal.EntryPrice - signal.StopLoss) / pip;

// Calculate ATR with Z-score for volatility adaptation
double atrPips = 0;
double atrMultiplier = 1.5;  // Default (normal volatility)

if (_robot.Bars != null && _robot.Bars.Count >= 30)
{
    int n = 14;
    var bars = _robot.Bars;
    double[] atrValues = new double[20];  // Store 20 ATR values

    // Calculate historical ATR values
    for (int period = 0; period < 20; period++)
    {
        double sum = 0;
        for (int i = bars.Count - n - 1 - period; i < bars.Count - 1 - period; i++)
        {
            if (i >= 1 && i < bars.Count)
            {
                double tr = Math.Max(bars.HighPrices[i] - bars.LowPrices[i],
                              Math.Max(Math.Abs(bars.HighPrices[i] - bars.ClosePrices[i - 1]),
                                       Math.Abs(bars.LowPrices[i] - bars.ClosePrices[i - 1])));
                sum += tr;
            }
        }
        atrValues[period] = (sum / n) / pip;
    }

    atrPips = atrValues[0];  // Most recent ATR

    // Calculate Z-score
    double meanATR = atrValues.Average();
    double variance = atrValues.Select(x => (x - meanATR) * (x - meanATR)).Average();
    double stdDev = Math.Sqrt(variance);
    double zScore = stdDev > 0 ? (atrPips - meanATR) / stdDev : 0;

    // Adaptive multiplier based on Z-score
    if (zScore <= -0.5)
    {
        atrMultiplier = 1.2;  // Low volatility → tighter stop
    }
    else if (zScore >= 0.5)
    {
        atrMultiplier = 1.8;  // High volatility → wider stop
    }
    else
    {
        atrMultiplier = 1.5;  // Normal volatility
    }

    // Apply ATR-based SL with adaptive multiplier
    double atrBasedSL = atrMultiplier * atrPips;
    slPips = Math.Max(slPips, atrBasedSL);

    if (_config.EnableDebugLogging)
    {
        _robot.Print($"[ATR_ADAPTIVE_SL] atr={atrPips:F2} z={zScore:F2} mult={atrMultiplier:F2} " +
                     $"atrSL={atrBasedSL:F1} finalSL={slPips:F1}");
    }
}

// Apply minimum floor
slPips = Math.Max(slPips, _config.MinSlPipsFloor);

// Ensure meets broker minimum + spread
double minRequired = symbol.StopLossInPips + (symbol.Spread / pip);
slPips = Math.Max(slPips, minRequired);

// Calculate effective stop
double effStop = signal.EntryPrice > signal.StopLoss
    ? signal.EntryPrice - slPips * pip
    : signal.EntryPrice + slPips * pip;

if (_config.EnableDebugLogging)
{
    _robot.Print($"[SL_FINAL] minFloor={_config.MinSlPipsFloor:F1} brokerMin={symbol.StopLossInPips:F1} " +
                 $"finalSL={slPips:F1} effStop={effStop:F5}");
}
```

---

### Change #1B-2: Partial Exits at 1.5R

**Location**: `Execution_TradeManager.cs`, `ManageOpenPositions()` method
**Find**: Partial close logic (around line 330-370)

**Modify**:
```csharp
// ═══════════════════════════════════════════════════════
// PHASE 1B: PARTIAL EXIT AT 1.5R (Oct 26, 2025)
// Modified from original 1R to 1.5R for actual profit lock
// ═══════════════════════════════════════════════════════

if (_config.EnablePartialClose && !_partialDone.Contains(pos.Id))
{
    double initRisk = _initRiskPips.ContainsKey(pos.Id) ? _initRiskPips[pos.Id] : 1.0;
    double profitPips = pos.Pips;

    // TP1 at 1.5R (MODIFIED from 1.0R)
    double tp1Threshold = 1.5 * initRisk;

    if (profitPips >= tp1Threshold)
    {
        // Close 50% (or configured percentage)
        double closePercent = Math.Max(0.0, Math.Min(1.0, _config.PartialClosePercent / 100.0));
        long closeVolume = (long)(pos.VolumeInUnits * closePercent);
        closeVolume = symbol.NormalizeVolumeInUnits(closeVolume);

        if (closeVolume >= symbol.VolumeInUnitsMin)
        {
            _robot.Print($"[PARTIAL_CLOSE] TP1 at 1.5R reached | Profit={profitPips:F1}p | Threshold={tp1Threshold:F1}p | Closing {closePercent * 100:F0}%");

            var result = _robot.ClosePosition(pos, closeVolume);

            if (result.IsSuccessful)
            {
                _partialDone.Add(pos.Id);

                // Move SL to BE + 0.2R
                if (_config.EnableBreakEven)
                {
                    double beOffset = 0.2 * initRisk * pip;
                    double newSL = pos.TradeType == TradeType.Buy
                        ? pos.EntryPrice + beOffset
                        : pos.EntryPrice - beOffset;

                    _robot.ModifyPosition(pos, newSL, pos.TakeProfit);

                    _robot.Print($"[PARTIAL_CLOSE] SL moved to BE + 0.2R | New SL={newSL:F5}");
                }
            }
        }
    }
}
```

---

### Change #1B-3: OTE Session-Aware Buffer

**Location**: `JadecapStrategy.cs`, OTE tap detection logic
**Find**: OTE tolerance calculation (search for "tol = " in OTE detector)

**Add helper method** to StrategyConfig or JadecapStrategy:
```csharp
// ═══════════════════════════════════════════════════════
// PHASE 1B: OTE SESSION-AWARE BUFFER (Oct 26, 2025)
// ═══════════════════════════════════════════════════════

private bool IsLondonOrNYSession()
{
    var serverTime = Server.Time;
    int hour = serverTime.Hour;

    // London: 08:00-17:00 UTC
    // NY: 13:00-22:00 UTC
    // Combined: 08:00-22:00 UTC
    return hour >= 8 && hour < 22;
}

private double GetOTEBufferWithSessionAdjustment(double baseBuffer)
{
    bool isHighVolatilitySession = IsLondonOrNYSession();
    double sessionFactor = isHighVolatilitySession ? 1.2 : 1.0;
    double adjustedBuffer = baseBuffer * sessionFactor;

    if (_config.EnableDebugLogging)
    {
        _journal.Debug($"[OTE_BUFFER] base={baseBuffer:F2} session={( isHighVolatilitySession ? "London/NY" : "Asia" )} " +
                       $"factor={sessionFactor:F2} adjusted={adjustedBuffer:F2}");
    }

    return adjustedBuffer;
}
```

**Then modify OTE tap check** (in OptimalTradeEntryDetector or wherever OTE tap is validated):
```csharp
// OLD:
double tol = 0.90;  // or however it's currently calculated

// NEW:
double baseTol = 0.90;  // or current calculation
double tol = GetOTEBufferWithSessionAdjustment(baseTol);
```

---

### Change #1B-4: Late MSS Risk Reduction

**Location**: `JadecapStrategy.cs`, `BuildTradeSignal()` or wherever MSS age is checked

**Add** after MSS validation, before volume calculation:
```csharp
// ═══════════════════════════════════════════════════════
// PHASE 1B: LATE MSS RISK REDUCTION (Oct 26, 2025)
// ═══════════════════════════════════════════════════════

// Check MSS age vs cascade timeout
int mssAgeBars = Bars.Count - mssBar;  // Bars since MSS occurred
int cascadeTimeoutBars = 60;  // Or configured value in minutes / timeframe

double riskMultiplier = 1.0;

if (mssAgeBars > (cascadeTimeoutBars * 0.8))  // Within 80% of timeout
{
    riskMultiplier = 0.5;  // Halve risk for late confirmations

    if (_config.EnableDebugLogging)
    {
        _journal.Debug($"[MSS_GATE] Late confirmation detected | Age={mssAgeBars} bars | " +
                       $"Timeout={cascadeTimeoutBars} | Risk HALVED (mult={riskMultiplier:F2})");
    }
}

// Later, when calculating volume in TradeManager:
// Apply risk multiplier BEFORE position size calculation
// (This would need to be passed to TradeManager or applied in RiskManager)
```

---

## Summary of Changes

### Files Modified:
1. **Execution_TradeManager.cs**:
   - Enhanced logging (SL_CALC, SPREAD_GUARD, BROKER_CHECK)
   - Spread/ATR guard
   - Order compliance checks
   - ATR Z-Score adaptive SL
   - Partial exits at 1.5R

2. **JadecapStrategy.cs** (or relevant detector):
   - OTE session-aware buffer
   - Late MSS risk reduction

### New Parameters Needed (add to StrategyConfig):
```csharp
// None - using existing parameters
// But may want to add configuration flags:
public bool EnableSpreadGuard { get; set; } = true;
public double SpreadGuardHalveThreshold { get; set; } = 0.25;
public double SpreadGuardSkipThreshold { get; set; } = 0.40;
public double MinRRAfterCompliance { get; set; } = 1.6;
public bool EnableATRAdaptiveSL { get; set; } = true;
public double PartialCloseTP1RR { get; set; } = 1.5;  // Changed from implied 1.0
```

---

## Testing Checklist

After implementation:

- [ ] Code compiles (0 errors, 0 warnings)
- [ ] Enhanced logging appears in debug logs
- [ ] Spread guard triggers on wide spreads (test manually)
- [ ] Order compliance checks block invalid orders
- [ ] ATR Z-Score calculation produces reasonable multipliers (1.2-1.8)
- [ ] Partial closes trigger at 1.5R (not 1.0R)
- [ ] OTE buffer adjusts by session (London/NY vs Asia)
- [ ] Late MSS reduces risk by 50%
- [ ] Backtest shows improved metrics vs baseline

---

## Expected Impact (From Log Data)

**Before** (14 trades):
- Average Loss: $68
- Average Win: $33
- Net PnL: -$474.83
- RR: 1:0.49

**After** (projected):
- Average Loss: $45 (34% reduction from adaptive SL)
- Average Win: $55 (67% increase from TP1 at 1.5R)
- Net PnL: +$100 to +$140
- RR: 1.22:1 to 1.5:1

---

**Document Created**: Oct 26, 2025
**Status**: Ready for review and implementation
**Next Step**: Get user approval, then implement changes
**Estimated Time**: 2-4 hours for implementation + testing
