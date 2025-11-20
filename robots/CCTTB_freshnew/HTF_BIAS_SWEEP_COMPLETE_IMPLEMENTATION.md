# Complete HTF-Aware Bias + Sweep System - Implementation Plan

**Date**: October 24, 2025
**Status**: READY TO IMPLEMENT
**Approach**: Full Phase 2 replacement with self-validation

---

## Executive Decision: Full HTF System Implementation

Based on your requirements and the TradingView/ICT resources analyzed, I will implement the **complete HTF-aware orchestrated system** with:

1. ✅ **HTF Power of Three logic** (from TradingView script analysis)
2. ✅ **Proper HTF data handling** (no repainting, completed candles only)
3. ✅ **Self-validation and compatibility checks** (your addendum requirement)
4. ✅ **State machine gates** (IDLE → CANDIDATE → CONFIRMED → READY_FOR_MSS)
5. ✅ **JSON orchestrator integration** (event emission + handshake)
6. ✅ **Auto HTF mapping** (5m→15m/1H, 15m→4H/1D)

---

## Key Insights from Resource Analysis

### From HTF Power of Three Indicator

**Three-Stage Campaign** (Accumulation → Manipulation → Distribution):
- **Accumulation**: Price forms around HTF open
- **Manipulation**: Liquidity sweep (break HTF high/low, then reverse)
- **Distribution**: Move in true direction after sweep

**Critical Levels**:
- HTF Open (entry reference)
- HTF High/Low (sweep targets)
- Previous HTF High/Low (liquidity pools)

### From HTF Candle Implementation Guide

**No Repainting Rules**:
- Only use **completed HTF candles** (never current forming candle)
- Use negative indexing: `close[-1]`, `close[-2]`, `close[-3]`
- Cache HTF OHLC at candle completion
- Never update historical values

**Alignment Requirements**:
- HTF candle boundaries must sync with LTF bars
- Account for timezone offsets (NY midnight for daily)
- Handle session gaps (weekends, holidays)

### From ThinkScript HTF Aggregation

**Projection Technique**:
- Display completed HTF candles beyond current bar
- Offset = 3 bars (empty space after last bar)
- Spacing = 2 bars between HTF candles
- Persistent support/resistance lines extend forward

**Look-Ahead Bias Prevention**:
- Read only completed bars: `close(period=agg)[-3]`
- Lock values permanently: `if b1 then h1 else h1[1]`
- Never reference current HTF bar (`[0]`)

---

## Architecture Overview

### New Classes (7 Total)

1. **HtfMapper.cs** - Auto-maps chart TF to HTF pair
2. **HtfDataProvider.cs** - Fetches and caches HTF OHLC (no repaint)
3. **LiquidityReferenceManager.cs** - Computes PDH/PDL/Asia/HTF levels
4. **BiasStateMachine.cs** - State machine (IDLE → READY_FOR_MSS)
5. **SweepValidator.cs** - Validates sweeps (break + return + displacement)
6. **OrchestratorGate.cs** - Gate enforcement + JSON events
7. **CompatibilityValidator.cs** - Self-checks + handshake

### Modified Classes (4 Total)

1. **JadecapStrategy.cs** - Integrate state machine, replace bias/sweep calls
2. **Signals_MSSignalDetector.cs** - Add gate check before detection
3. **Data_MarketDataProvider.cs** - Replace GetCurrentBias() with state machine
4. **Signals_LiquiditySweepDetector.cs** - Replace with SweepValidator

---

## Implementation Details

### 1. HtfMapper.cs (Auto Timeframe Selection)

```csharp
using cAlgo.API;

namespace CCTTB
{
    public class HtfMapper
    {
        public (TimeFrame primary, TimeFrame secondary) GetHtfPair(TimeFrame chartTf)
        {
            // Chart 5m → HTF 15m + 1H
            if (chartTf == TimeFrame.Minute5)
                return (TimeFrame.Minute15, TimeFrame.Hour);

            // Chart 15m → HTF 4H + 1D
            if (chartTf == TimeFrame.Minute15)
                return (TimeFrame.Hour4, TimeFrame.Daily);

            // Unsupported
            throw new System.ArgumentException($"Chart TF {chartTf} not supported. Use 5m or 15m.");
        }

        public string GetHtfLabel(TimeFrame htf)
        {
            if (htf == TimeFrame.Minute15) return "15m";
            if (htf == TimeFrame.Hour) return "1H";
            if (htf == TimeFrame.Hour4) return "4H";
            if (htf == TimeFrame.Daily) return "1D";
            return htf.ToString();
        }
    }
}
```

### 2. HtfDataProvider.cs (No-Repaint HTF OHLC)

```csharp
using cAlgo.API;
using System.Collections.Generic;

namespace CCTTB
{
    public class HtfCandle
    {
        public double Open { get; set; }
        public double High { get; set; }
        public double Low { get; set; }
        public double Close { get; set; }
        public System.DateTime OpenTime { get; set; }
        public System.DateTime CloseTime { get; set; }
        public bool IsCompleted { get; set; }
    }

    public class HtfDataProvider
    {
        private readonly Robot _bot;
        private readonly Symbol _symbol;
        private readonly MarketData _marketData;

        private Dictionary<TimeFrame, Bars> _htfBarsCache = new Dictionary<TimeFrame, Bars>();
        private Dictionary<TimeFrame, HtfCandle> _lastCompletedCandle = new Dictionary<TimeFrame, HtfCandle>();

        public HtfDataProvider(Robot bot, Symbol symbol, MarketData marketData)
        {
            _bot = bot;
            _symbol = symbol;
            _marketData = marketData;
        }

        public Bars GetHtfBars(TimeFrame htf)
        {
            if (!_htfBarsCache.ContainsKey(htf))
            {
                _htfBarsCache[htf] = _marketData.GetSeries(_symbol, htf);
            }
            return _htfBarsCache[htf];
        }

        /// <summary>
        /// Get LAST COMPLETED HTF candle (prevents repainting)
        /// </summary>
        public HtfCandle GetLastCompletedCandle(TimeFrame htf)
        {
            var bars = GetHtfBars(htf);
            if (bars == null || bars.Count < 2) return null;

            // Use [-2] to get LAST COMPLETED candle ([-1] is current forming)
            int idx = bars.Count - 2;

            return new HtfCandle
            {
                Open = bars.OpenPrices[idx],
                High = bars.HighPrices[idx],
                Low = bars.LowPrices[idx],
                Close = bars.ClosePrices[idx],
                OpenTime = bars.OpenTimes[idx],
                CloseTime = bars.OpenTimes[idx + 1], // Next candle open = this candle close
                IsCompleted = true
            };
        }

        /// <summary>
        /// Get PREVIOUS COMPLETED HTF candle ([-3])
        /// </summary>
        public HtfCandle GetPreviousCompletedCandle(TimeFrame htf)
        {
            var bars = GetHtfBars(htf);
            if (bars == null || bars.Count < 3) return null;

            int idx = bars.Count - 3;

            return new HtfCandle
            {
                Open = bars.OpenPrices[idx],
                High = bars.HighPrices[idx],
                Low = bars.LowPrices[idx],
                Close = bars.ClosePrices[idx],
                OpenTime = bars.OpenTimes[idx],
                CloseTime = bars.OpenTimes[idx + 1],
                IsCompleted = true
            };
        }

        /// <summary>
        /// Check if HTF candle just completed (for event triggering)
        /// </summary>
        public bool DidHtfCandleJustComplete(TimeFrame htf, System.DateTime currentTime)
        {
            var lastCompleted = GetLastCompletedCandle(htf);
            if (lastCompleted == null) return false;

            // Check if we have a cached version
            if (_lastCompletedCandle.ContainsKey(htf))
            {
                var cached = _lastCompletedCandle[htf];
                if (cached.OpenTime == lastCompleted.OpenTime)
                    return false; // Same candle, no new completion
            }

            // New completed candle detected
            _lastCompletedCandle[htf] = lastCompleted;
            return true;
        }
    }
}
```

### 3. LiquidityReferenceManager.cs (HTF Levels)

```csharp
using cAlgo.API;
using System;
using System.Collections.Generic;
using System.Linq;

namespace CCTTB
{
    public class LiquidityReference
    {
        public string Label { get; set; }          // "PDH", "Asia_H", "4H_H", etc.
        public double Level { get; set; }          // Price level
        public string Type { get; set; }           // "Supply" or "Demand"
        public TimeFrame? SourceHtf { get; set; }  // null for PDH/Asia, TimeFrame for HTF levels
        public DateTime ComputedAt { get; set; }
    }

    public class LiquidityReferenceManager
    {
        private readonly Robot _bot;
        private readonly Symbol _symbol;
        private readonly HtfDataProvider _htfData;

        public LiquidityReferenceManager(Robot bot, Symbol symbol, HtfDataProvider htfData)
        {
            _bot = bot;
            _symbol = symbol;
            _htfData = htfData;
        }

        public List<LiquidityReference> ComputeAllReferences(TimeFrame htfPrimary, TimeFrame htfSecondary)
        {
            var refs = new List<LiquidityReference>();
            var now = _bot.Server.Time;

            // 1. PDH/PDL (Previous Day High/Low)
            var pdh = ComputePDH();
            var pdl = ComputePDL();
            if (pdh > 0) refs.Add(new LiquidityReference { Label = "PDH", Level = pdh, Type = "Supply", ComputedAt = now });
            if (pdl > 0) refs.Add(new LiquidityReference { Label = "PDL", Level = pdl, Type = "Demand", ComputedAt = now });

            // 2. Asia Session H/L
            var asiaH = ComputeAsiaHigh();
            var asiaL = ComputeAsiaLow();
            if (asiaH > 0) refs.Add(new LiquidityReference { Label = "Asia_H", Level = asiaH, Type = "Supply", ComputedAt = now });
            if (asiaL > 0) refs.Add(new LiquidityReference { Label = "Asia_L", Level = asiaL, Type = "Demand", ComputedAt = now });

            // 3. HTF Primary (current + previous)
            var htfPri = _htfData.GetLastCompletedCandle(htfPrimary);
            var htfPriPrev = _htfData.GetPreviousCompletedCandle(htfPrimary);
            if (htfPri != null)
            {
                refs.Add(new LiquidityReference { Label = $"{GetHtfLabel(htfPrimary)}_H", Level = htfPri.High, Type = "Supply", SourceHtf = htfPrimary, ComputedAt = now });
                refs.Add(new LiquidityReference { Label = $"{GetHtfLabel(htfPrimary)}_L", Level = htfPri.Low, Type = "Demand", SourceHtf = htfPrimary, ComputedAt = now });
            }
            if (htfPriPrev != null)
            {
                refs.Add(new LiquidityReference { Label = $"Prev_{GetHtfLabel(htfPrimary)}_H", Level = htfPriPrev.High, Type = "Supply", SourceHtf = htfPrimary, ComputedAt = now });
                refs.Add(new LiquidityReference { Label = $"Prev_{GetHtfLabel(htfPrimary)}_L", Level = htfPriPrev.Low, Type = "Demand", SourceHtf = htfPrimary, ComputedAt = now });
            }

            // 4. HTF Secondary (current + previous)
            var htfSec = _htfData.GetLastCompletedCandle(htfSecondary);
            var htfSecPrev = _htfData.GetPreviousCompletedCandle(htfSecondary);
            if (htfSec != null)
            {
                refs.Add(new LiquidityReference { Label = $"{GetHtfLabel(htfSecondary)}_H", Level = htfSec.High, Type = "Supply", SourceHtf = htfSecondary, ComputedAt = now });
                refs.Add(new LiquidityReference { Label = $"{GetHtfLabel(htfSecondary)}_L", Level = htfSec.Low, Type = "Demand", SourceHtf = htfSecondary, ComputedAt = now });
            }
            if (htfSecPrev != null)
            {
                refs.Add(new LiquidityReference { Label = $"Prev_{GetHtfLabel(htfSecondary)}_H", Level = htfSecPrev.High, Type = "Supply", SourceHtf = htfSecondary, ComputedAt = now });
                refs.Add(new LiquidityReference { Label = $"Prev_{GetHtfLabel(htfSecondary)}_L", Level = htfSecPrev.Low, Type = "Demand", SourceHtf = htfSecondary, ComputedAt = now });
            }

            return refs;
        }

        private double ComputePDH()
        {
            // Get daily bars
            var dailyBars = _htfData.GetHtfBars(TimeFrame.Daily);
            if (dailyBars == null || dailyBars.Count < 2) return 0;

            // Previous day (completed) = [-2]
            return dailyBars.HighPrices[dailyBars.Count - 2];
        }

        private double ComputePDL()
        {
            var dailyBars = _htfData.GetHtfBars(TimeFrame.Daily);
            if (dailyBars == null || dailyBars.Count < 2) return 0;
            return dailyBars.LowPrices[dailyBars.Count - 2];
        }

        private double ComputeAsiaHigh()
        {
            // Asia session: 00:00-09:00 UTC
            // Scan last 24 hours of M5 bars, find high in Asia window
            var bars = _bot.Bars;
            if (bars == null || bars.Count < 100) return 0;

            double maxHigh = 0;
            for (int i = bars.Count - 1; i >= Math.Max(0, bars.Count - 288); i--) // 288 bars = 24h at M5
            {
                var time = bars.OpenTimes[i];
                if (time.Hour >= 0 && time.Hour < 9) // Asia window
                {
                    maxHigh = Math.Max(maxHigh, bars.HighPrices[i]);
                }
            }
            return maxHigh;
        }

        private double ComputeAsiaLow()
        {
            var bars = _bot.Bars;
            if (bars == null || bars.Count < 100) return double.MaxValue;

            double minLow = double.MaxValue;
            for (int i = bars.Count - 1; i >= Math.Max(0, bars.Count - 288); i--)
            {
                var time = bars.OpenTimes[i];
                if (time.Hour >= 0 && time.Hour < 9)
                {
                    minLow = Math.Min(minLow, bars.LowPrices[i]);
                }
            }
            return minLow == double.MaxValue ? 0 : minLow;
        }

        private string GetHtfLabel(TimeFrame htf)
        {
            if (htf == TimeFrame.Minute15) return "15m";
            if (htf == TimeFrame.Hour) return "1H";
            if (htf == TimeFrame.Hour4) return "4H";
            if (htf == TimeFrame.Daily) return "1D";
            return htf.ToString();
        }
    }
}
```

---

### 4. BiasStateMachine.cs (Core State Logic)

**This is the longest file - see next section for complete implementation**

---

## Self-Validation Requirements (Your Addendum)

### CompatibilityValidator.cs

```csharp
using System;
using System.Collections.Generic;
using System.Linq;

namespace CCTTB
{
    public class CompatibilityCheck
    {
        public bool IsValid { get; set; }
        public string Component { get; set; }
        public string Message { get; set; }
        public DateTime CheckedAt { get; set; }
    }

    public class CompatibilityValidator
    {
        private List<CompatibilityCheck> _checks = new List<CompatibilityCheck>();

        public bool ValidateAll(
            OrchestratorGate gate,
            HtfMapper mapper,
            HtfDataProvider htfData,
            LiquidityReferenceManager refManager,
            cAlgo.API.TimeFrame chartTf)
        {
            _checks.Clear();

            // 1. Orchestrator gate endpoints reachable
            _checks.Add(new CompatibilityCheck
            {
                Component = "OrchestratorGate",
                IsValid = gate != null && gate.IsInitialized(),
                Message = gate != null ? "Gate initialized" : "Gate not initialized",
                CheckedAt = DateTime.UtcNow
            });

            // 2. TF map compatibility
            try
            {
                var (primary, secondary) = mapper.GetHtfPair(chartTf);
                _checks.Add(new CompatibilityCheck
                {
                    Component = "HtfMapper",
                    IsValid = true,
                    Message = $"Chart {chartTf} mapped to HTF {primary}/{secondary}",
                    CheckedAt = DateTime.UtcNow
                });
            }
            catch (Exception ex)
            {
                _checks.Add(new CompatibilityCheck
                {
                    Component = "HtfMapper",
                    IsValid = false,
                    Message = $"TF mapping failed: {ex.Message}",
                    CheckedAt = DateTime.UtcNow
                });
            }

            // 3. HTF data availability
            var (pri, sec) = mapper.GetHtfPair(chartTf);
            var priCandle = htfData.GetLastCompletedCandle(pri);
            var secCandle = htfData.GetLastCompletedCandle(sec);
            _checks.Add(new CompatibilityCheck
            {
                Component = "HtfDataProvider",
                IsValid = priCandle != null && secCandle != null,
                Message = priCandle != null && secCandle != null
                    ? "HTF data available"
                    : "HTF data missing or insufficient bars",
                CheckedAt = DateTime.UtcNow
            });

            // 4. Reference levels valid
            var refs = refManager.ComputeAllReferences(pri, sec);
            bool allRefsValid = refs.All(r => r.Level > 0 && !double.IsNaN(r.Level) && !double.IsInfinity(r.Level));
            _checks.Add(new CompatibilityCheck
            {
                Component = "LiquidityReferenceManager",
                IsValid = allRefsValid && refs.Count >= 4,
                Message = $"{refs.Count} references computed, all valid: {allRefsValid}",
                CheckedAt = DateTime.UtcNow
            });

            // 5. Threshold parameters loaded
            // TODO: Load from config and validate
            _checks.Add(new CompatibilityCheck
            {
                Component = "ThresholdConfig",
                IsValid = true, // Placeholder
                Message = "Thresholds use default values (config integration pending)",
                CheckedAt = DateTime.UtcNow
            });

            return _checks.All(c => c.IsValid);
        }

        public string GetValidationReport()
        {
            var report = "=== COMPATIBILITY VALIDATION REPORT ===\n";
            foreach (var check in _checks)
            {
                string status = check.IsValid ? "✓ PASS" : "✗ FAIL";
                report += $"{status} | {check.Component}: {check.Message}\n";
            }
            report += $"\nOverall: {(IsAllValid() ? "COMPATIBLE" : "INCOMPATIBLE")}\n";
            return report;
        }

        public bool IsAllValid() => _checks.All(c => c.IsValid);

        public List<CompatibilityCheck> GetFailedChecks() => _checks.Where(c => !c.IsValid).ToList();
    }
}
```

---

## Next Steps

I will now implement the **complete BiasStateMachine.cs** with:
- State transitions (IDLE → CANDIDATE → CONFIRMED → READY_FOR_MSS)
- Sweep validation (break + return + displacement)
- HTF body alignment confidence grading
- Invalidation logic (opposite sweep + flip threshold)

Then integrate into JadecapStrategy.cs and add JSON event emission.

**Proceed with BiasStateMachine.cs implementation?**
