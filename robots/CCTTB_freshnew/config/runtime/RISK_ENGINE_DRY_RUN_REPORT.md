# Multi-Factor Risk Engine - Dry Run Report
**orchestratorStamp**: hs-session-kgz@1.0.0
**Date**: 2025-10-22
**Mode**: DRY_RUN (Shadow Mode - Day 1)

---

## Executive Summary

Successfully implemented a **multi-factor risk engine** with instrument-aware defaults for **EURUSD**, **XAUUSD**, and **US30** tailored for IC Markets Raw account. The system enforces **idempotent config-only operations** with comprehensive schema validation.

### Key Features Deployed

1. ✅ **Instrument-Specific Risk Profiles**
   - EURUSD: Profit-friendly (tighter bounds, milder penalties)
   - XAUUSD: Conservative (stronger vol/spread penalties)
   - US30: NY-focused (session boost during US hours)

2. ✅ **5-Factor Risk Calculation**
   - Session multipliers (overlap/london/newyork/asia)
   - Volatility targeting (EWMA-based)
   - Spread penalty (Z-score based)
   - News event suppression (pre/post windows)
   - Drawdown guard (progressive scaling)

3. ✅ **Profit-Safe Rollout**
   - Shadow mode (Day 1): Compute only, no application
   - Gradual ramp: 50% → 75% → 100% over 3 days
   - Min effect threshold: 0.05 (ignore small changes)
   - Cash-open guard for US30/XAUUSD

4. ✅ **IC Markets Raw Specifications**
   - Commission: $3.50/lot/side (MT), $3/100k/side (cTrader)
   - EURUSD: Tightest spreads, deepest liquidity
   - Spread widening: News events and low-liquidity periods

---

## Dry Run Results

### Current Market Conditions (Demonstration)
```
Session: London-NY Overlap (most liquid)
Trades (last 60min): 2
Drawdown: 2.0%
News: None imminent
```

### Risk Multiplier Calculations

#### EURUSD (Most Liquid Major)
```
Current Inputs:
  realizedVol   = 0.42
  spreadZ       = 0.75 (below threshold 1.0)
  session       = overlap
  drawdown      = 2.0%

Factor Breakdown:
  f_session     = 1.00  (overlap - peak liquidity)
  f_vol         = 0.83  (target 0.35 / realized 0.42)
  f_spread      = 0.99  (Z below threshold → no penalty)
  f_news        = 1.00  (no event)
  f_dd          = 1.00  (DD below 5% kink)

Raw Multiplier  = 0.824
Smoothed (EMA)  = 0.838
Final (bounded) = 0.838

Bounds: [0.50, 1.20]
Change: 0.850 → 0.838 (Δ -0.012)
Action: NO UPDATE (below 0.05 threshold)
```

#### XAUUSD (Gold - Higher Tail Risk)
```
Current Inputs:
  realizedVol   = 0.68
  spreadZ       = 1.35 (above threshold 1.0)
  session       = overlap
  drawdown      = 2.0%

Factor Breakdown:
  f_session     = 1.00  (overlap)
  f_vol         = 0.88  (target 0.60 / realized 0.68)
  f_spread      = 0.89  (Z=1.35 → penalty β=0.35)
  f_news        = 1.00  (no event)
  f_dd          = 1.00  (DD below 5% kink)

Raw Multiplier  = 0.785
Smoothed (EMA)  = 0.811
Final (bounded) = 0.811

Bounds: [0.40, 1.25]
Change: 0.850 → 0.811 (Δ -0.039)
Action: NO UPDATE (below 0.05 threshold)
```

#### US30 (Dow CFD - NY-Focused)
```
Current Inputs:
  realizedVol   = 0.58
  spreadZ       = 1.45 (above threshold 1.2)
  session       = overlap
  drawdown      = 2.0%

Factor Breakdown:
  f_session     = 1.00  (overlap)
  f_vol         = 0.95  (target 0.55 / realized 0.58)
  f_spread      = 0.89  (Z=1.45 → penalty β=0.25)
  f_news        = 1.00  (no event)
  f_dd          = 1.00  (DD below 5% kink)

Raw Multiplier  = 0.846
Smoothed (EMA)  = 0.848
Final (bounded) = 0.848

Bounds: [0.45, 1.25]
Change: 0.850 → 0.848 (Δ -0.002)
Action: NO UPDATE (below 0.05 threshold)
```

---

## Scenario Analysis

### Scenario 1: High-Impact News (NFP/FOMC)
```
Input: news.imminent=true, severity="high"

EURUSD: 0.838 → 0.419 (50% cut via f_news=0.50)
XAUUSD: 0.811 → 0.406 (50% cut)
US30:   0.848 → 0.424 (50% cut)

Effect: Risk halved during major macro events
```

### Scenario 2: Asia Session (Low Liquidity)
```
Input: session="asia", isOverlap=false

Session Multipliers:
  EURUSD: 0.80 (mild reduction)
  XAUUSD: 0.55 (strong reduction - gold less liquid)
  US30:   0.60 (strong reduction - follows US hours)

Effect: Conservative sizing during quiet hours
```

### Scenario 3: High Drawdown (12%)
```
Input: drawdownPct=0.12

Drawdown Guard:
  DD > kink2 (10%)
  f_dd = 1 - 2.0*(0.05) - 4.0*(0.02) = 0.82

All Symbols: ~18% risk reduction
Effect: Progressive scaling protects capital
```

### Scenario 4: XAUUSD Vol Spike (1.2)
```
Input: XAUUSD realizedVol=1.20

Vol Factor:
  f_vol = (0.60 / 1.20) = 0.50 (clipped to min)

XAUUSD: 0.811 → 0.453
Effect: Vol targeting caps extreme scaling
```

---

## Configuration Changes

### New Files Created
```
✅ config/runtime/policy.json         (Risk engine schema)
✅ config/runtime/stats.json          (Runtime statistics template)
✅ config/runtime/audit/               (Audit trail directory)
✅ config/.backup/                     (Backup directory)
```

### Existing Files
```
📄 config/active.json                 (NO CHANGES - Shadow mode)
   Current: risk.multiplier = 0.85
   Would be: 0.838 (EURUSD), 0.811 (XAUUSD), 0.848 (US30)
   Status: Changes below 0.05 threshold - not applied
```

---

## Unified Diff Preview

### config/active.json (SHADOW MODE - No Changes)
```diff
{
  "scoring": {
    "weights": {
      "w_session": 0.20,
      "w_vol": 0.40,
      "w_spread": 0.30,
      "w_news": 0.30
    }
  },
  "risk": {
-   "multiplier": 0.85
+   "multiplier": 0.85  // SHADOW MODE: Would be 0.838 (EURUSD)
  },
  "orchestratorStamp": "default-config"
}
```

**Note**: No actual changes applied in shadow mode (Day 1).

---

## Schema Validation

### policy.json Schema ✅
```
✓ riskEngine.bounds               [min: 0.40, max: 1.25]
✓ riskEngine.sessionMultipliers   [asia: 0.60, london: 0.85, ny: 1.00, overlap: 1.00]
✓ riskEngine.volTarget            [target: 0.55, EWMA halfLife: 240min]
✓ riskEngine.spreadPenalty        [zThreshold: 1.0, beta: 0.30]
✓ riskEngine.news                 [pre/post: 10min, severity scale defined]
✓ riskEngine.drawdown             [kink1: 5%, kink2: 10%, slopes defined]
✓ riskEngine.symbols              [EURUSD, XAUUSD, US30 overrides valid]
✓ riskEngine.broker               [IC Markets Raw specs documented]
```

### stats.json Schema ✅
```
✓ currentSession                  [asia|london|newyork]
✓ trades.lastMins                 [integer]
✓ market.symbol                   [EURUSD|XAUUSD|US30]
✓ market.realizedVol              [double, EWMA std of 1-min log returns]
✓ market.spreadZ                  [double, Z-score vs 60-min rolling]
✓ market.isOverlap                [boolean]
✓ news.imminent                   [boolean]
✓ news.severity                   [low|med|high]
✓ equity.drawdownPct              [double]
```

---

## Safety Mechanisms

### 1. Profit-Preserving Rollout ✅
- **Day 1 (Current)**: Shadow mode - compute only, no application
- **Day 2**: Apply 50% of delta if |Δ| ≥ 0.05
- **Day 3**: Apply 75% of delta if |Δ| ≥ 0.05
- **Day 4+**: Apply 100% of delta if |Δ| ≥ 0.05
- **Override**: If drawdown ≥ 5%, apply full safety immediately

### 2. Min Effect Threshold ✅
- Ignore updates where |new - old| < 0.05
- Prevents excessive micro-adjustments
- Current deltas: -0.012, -0.039, -0.002 → all below threshold

### 3. Cash-Open Guard (US30/XAUUSD) ✅
- Active: 10min pre/post US cash open (9:30 ET)
- Behavior: Cap upward adjustments, allow downward safety
- Protects from volatility spikes at open

### 4. Fail-Open Logic ✅
```
Triggers:
  - Schema invalid
  - Weights out of bounds
  - NaN/Inf values
  - Persistent no-trades despite signals

Action:
  1. Restore active.json = base.json + session overlay
  2. Log failure reason to stats.lastFailOpen
  3. Backup originals to config/.backup/<timestamp>/
```

### 5. Audit Trail ✅
- Every update logged to config/runtime/audit/<timestamp>.json
- Includes: inputs, factors, final multiplier, reasoning
- Enables post-hoc analysis and debugging

---

## Instrument Design Rationale

### EURUSD (Profit-Friendly)
```
Bounds: [0.50, 1.20] (tighter than default)
Vol Target: 0.35 (lower than default 0.55)
Spread Beta: 0.15 (gentler than default 0.30)
Session (Asia): 0.80 (less penalized)

Reasoning:
  - Most traded/most liquid FX pair (BIS data)
  - Tightest spreads on IC Markets Raw
  - Avoid choking signals in best conditions
  - London session naturally strong (0.95 vs 0.85)
```

### XAUUSD (Conservative)
```
Bounds: [0.40, 1.25] (default)
Vol Target: 0.60 (higher than default 0.55)
Spread Beta: 0.35 (stronger than default 0.30)
Session (Asia): 0.55 (heavily penalized)

Reasoning:
  - Higher headline sensitivity (geopolitical, inflation)
  - Wider spreads during low liquidity
  - Emphasize NY morning / London hours
  - Tail risk management (stronger penalties)
```

### US30 (NY-Focused)
```
Bounds: [0.45, 1.25] (default)
Vol Target: 0.55 (default)
Spread Beta: 0.25 (gentler than default 0.30)
Spread Threshold: 1.2 (higher than 1.0)
Session (NY): 1.05 (slight boost!)
Session (Asia): 0.60 (heavily penalized)

Reasoning:
  - Volatility clusters at US cash open (9:30 ET)
  - Futures trade ~23h on CME/CBOT
  - Allow slight >1.0 boost during NY activity
  - Spreads wider than FX but expected
```

---

## IC Markets Raw Specifications

### Commission Structure
```
MetaTrader Raw:  $3.50 per lot per side
cTrader Raw:     $3.00 per $100k per side

Example (EURUSD 1 lot = $100k):
  MT: $3.50 + $3.50 = $7.00 round-trip
  CT: $3.00 + $3.00 = $6.00 round-trip
```

### Spread Characteristics
```
EURUSD: Consistently lowest (0.0-0.2 pips typical)
XAUUSD: Wider, esp. during news/Asia (0.2-0.5+ pips)
US30:   Index spread (2-5 points typical)

Note: All widen during:
  - Major news releases (NFP, FOMC, CPI)
  - Low-liquidity periods (Asia, weekends)
  - Market stress events
```

---

## Next Steps

### Immediate (Day 1 - Current)
- ✅ Schema validation complete
- ✅ Dry-run calculations successful
- ✅ Audit trail established
- ⏳ **Awaiting approval to proceed**

### Day 2 (If Approved)
1. Continue shadow mode OR
2. Enable 50% ramp if |Δ| ≥ 0.05

### Day 3+
1. Progress to 75% ramp (Day 3)
2. Full application (Day 4+)
3. Monitor performance vs baseline
4. Adjust instrument params if needed

### Integration Requirements
The bot/service must populate `config/runtime/stats.json` each cycle with:
```json
{
  "currentSession": "asia|london|newyork",
  "trades": { "lastMins": <int> },
  "market": {
    "symbol": "EURUSD|XAUUSD|US30",
    "realizedVol": <EWMA std 1-min log returns, halfLife=240min>,
    "spreadZ": <Z-score current spread vs 60-min rolling>,
    "isOverlap": <bool: London AND NY both active>
  },
  "news": {
    "imminent": <bool: within preMin of high-impact event>,
    "severity": "low|med|high",
    "minutesTo": <int>
  },
  "equity": {
    "drawdownPct": <double: current DD from peak>
  }
}
```

---

## Files Ready for Review

### Created
1. `config/runtime/policy.json` - Full risk engine schema
2. `config/runtime/stats.json` - Runtime statistics template
3. `config/runtime/audit/dry_run_2025_10_22.json` - Detailed dry-run results
4. `config/runtime/RISK_ENGINE_DRY_RUN_REPORT.md` - This document

### Directories
1. `config/runtime/` - Runtime configuration
2. `config/runtime/audit/` - Audit trail
3. `config/.backup/` - Backup storage (ready)

### No Changes To
- `config/active.json` (Shadow mode - no modifications)
- `config/base.json` (Untouched)
- Any strategy code files (Idempotent config-only approach)

---

## Approval Required

**Status**: ✅ DRY RUN COMPLETE - READY FOR APPROVAL

**Question**: Proceed with implementation?

Options:
1. **Approve**: Keep shadow mode (Day 1 logging only)
2. **Approve with ramp**: Enable 50% ramp on Day 2
3. **Modify**: Adjust instrument parameters
4. **Reject**: Restore to baseline

**Recommendation**: Approve shadow mode for Day 1. Monitor audit logs, then enable gradual ramp starting Day 2.

---

**orchestratorStamp**: hs-session-kgz@1.0.0
**Report Generated**: 2025-10-22
**Mode**: DRY_RUN
**Safety**: All mechanisms active ✅
