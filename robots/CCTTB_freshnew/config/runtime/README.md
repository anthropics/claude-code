# Risk Engine Runtime Configuration

**orchestratorStamp**: hs-session-kgz@1.0.0
**Deployed**: 2025-10-22
**Status**: SHADOW MODE (Day 1)

---

## Directory Structure

```
config/runtime/
├── policy.json                    # Risk engine schema and parameters
├── stats.json                     # Runtime statistics (populated by bot)
├── DEPLOYMENT_STATUS.json         # Deployment tracking and phase status
├── RISK_ENGINE_DRY_RUN_REPORT.md # Comprehensive documentation
├── README.md                      # This file
└── audit/
    └── *.json                     # Timestamped audit logs
```

---

## Quick Start

### 1. Bot Integration (REQUIRED)

Your trading bot **MUST** populate `stats.json` each cycle:

```json
{
  "currentSession": "asia|london|newyork",
  "trades": { "lastMins": <trade_count_last_60min> },
  "market": {
    "symbol": "EURUSD|XAUUSD|US30",
    "realizedVol": <EWMA_std_1min_log_returns_halfLife_240>,
    "spreadZ": <current_spread_Z_score_vs_60min_rolling>,
    "isOverlap": <true_if_london_AND_newyork_active>
  },
  "news": {
    "imminent": <true_if_within_preMin_of_high_impact>,
    "severity": "low|med|high",
    "minutesTo": <minutes_to_next_event>
  },
  "equity": {
    "drawdownPct": <current_drawdown_from_peak>
  }
}
```

### 2. Risk Multiplier Calculation

Each cycle, compute:

```python
pol = policy.riskEngine
sym = stats.market.symbol
symPol = pol.symbols.get(sym, {})

def G(key): return symPol.get(key, pol[key])

# 1) Session factor
session = "overlap" if stats.market.isOverlap else stats.currentSession
f_session = G("sessionMultipliers")[session]

# 2) Vol targeting
vt = G("volTarget")
f_vol = clamp((vt["target"] / max(eps, stats.market.realizedVol)) ** vt["alpha"], 0.5, 1.5)

# 3) Spread penalty
sp = G("spreadPenalty")
f_spread = exp(-sp["beta"] * max(0, stats.market.spreadZ - sp["zThreshold"]))

# 4) News penalty
sevMap = pol["news"]["severityScale"]
f_news = sevMap[stats.news.severity] if stats.news.imminent else 1.0

# 5) Drawdown guard
DD = stats.equity.drawdownPct
d = pol["drawdown"]
if DD < d["kink1"]:
    f_dd = 1.0
elif DD < d["kink2"]:
    f_dd = 1 - d["slope1"] * (DD - d["kink1"])
else:
    f_dd = max(pol["bounds"]["min"],
               1 - d["slope1"]*(d["kink2"]-d["kink1"]) - d["slope2"]*(DD-d["kink2"]))

# Raw multiplier
raw = f_session * f_vol * f_spread * f_news * f_dd

# Smoothing (EMA)
halfLife = pol["smooth"]["halfLifeMin"]
alpha = 1 - exp(-ln(2) / halfLife)
smoothed = stats.prevRiskMultiplier * (1 - alpha) + raw * alpha

# Bounds
lo, hi = G("bounds")["min"], G("bounds")["max"]
risk.multiplier = clamp(smoothed, lo, hi)
```

### 3. Shadow Mode (Day 1)

**Current behavior**: Compute `risk.multiplier` but **DO NOT APPLY** to live trading.

**Action**: Log to `audit/<timestamp>.json` with full factor breakdown.

### 4. Ramp Schedule (Days 2-4)

- **Day 2**: Apply 50% of `(new - old)` if `|new - old| >= 0.05`
- **Day 3**: Apply 75% of `(new - old)` if `|new - old| >= 0.05`
- **Day 4+**: Apply 100% of `(new - old)` if `|new - old| >= 0.05`

**Override**: If `drawdownPct >= 0.05`, apply full safety immediately (bypass shadow/ramp).

---

## Configuration Files

### policy.json

**Purpose**: Risk engine schema and parameters
**Edit**: Manually (adjust instrument params, bounds, etc.)
**Read by**: Bot on startup and config reload

**Key sections**:
- `riskEngine.bounds`: Global min/max multipliers
- `riskEngine.sessionMultipliers`: Asia/London/NY/Overlap factors
- `riskEngine.volTarget`: Volatility targeting params
- `riskEngine.spreadPenalty`: Spread Z-score penalty
- `riskEngine.news`: News event severity scaling
- `riskEngine.drawdown`: Progressive drawdown guard
- `riskEngine.symbols`: EURUSD/XAUUSD/US30 overrides
- `riskEngine.broker`: IC Markets Raw specifications

### stats.json

**Purpose**: Runtime market/equity statistics
**Edit**: Populated by bot each cycle
**Read by**: Risk multiplier calculation

**Update frequency**: Every bar/tick cycle

### DEPLOYMENT_STATUS.json

**Purpose**: Track deployment phase and progress
**Edit**: Automatically (or manually for phase transitions)
**Read by**: Monitoring/dashboard

---

## Instrument Profiles

### EURUSD (Profit-Friendly)
```
Bounds: [0.50, 1.20]
Vol Target: 0.35
Spread Beta: 0.15 (gentle)
Asia Session: 0.80

Rationale: Most liquid FX pair, tightest spreads, avoid choking signals
```

### XAUUSD (Conservative)
```
Bounds: [0.40, 1.25]
Vol Target: 0.60
Spread Beta: 0.35 (aggressive)
Asia Session: 0.55

Rationale: Headline-sensitive, wider spreads, tail risk management
```

### US30 (NY-Focused)
```
Bounds: [0.45, 1.25]
Vol Target: 0.55
Spread Beta: 0.25
NY Session: 1.05 (boost!)
Asia Session: 0.60

Rationale: Follows US cash hours, volatility at 9:30 ET open
```

---

## Safety Mechanisms

### 1. Shadow Mode (Day 1)
- Compute risk.multiplier but DO NOT apply
- Log all calculations to audit/
- Zero impact on live trading

### 2. Min Effect Threshold (0.05)
- Ignore changes where `|new - old| < 0.05`
- Prevents excessive micro-adjustments

### 3. Drawdown Override
- If `drawdownPct >= 0.05`, apply full safety immediately
- Bypasses shadow mode and ramp schedule

### 4. Cash-Open Guard (US30/XAUUSD)
- Active: 10min pre/post US cash open (9:30 ET)
- Cap upward adjustments, allow downward safety

### 5. Fail-Open
- On schema error / NaN / invalid values
- Restore `active.json = base.json + session overlay`
- Log to `stats.lastFailOpen`

### 6. Audit Trail
- Every risk.multiplier update logged
- Includes: inputs, factors, reasoning
- Enables post-hoc analysis

---

## Daily Monitoring

### Day 1 Checklist
1. ✅ Verify `stats.json` is being populated correctly
2. ✅ Check `audit/` logs for factor breakdowns
3. ✅ Confirm calculated multipliers are reasonable
4. ✅ Validate EWMA vol and spread Z-score calculations
5. ✅ Review any fail-open events (should be none)
6. ⏳ Decide on Day 2 ramp approval

### Key Metrics to Watch
- `realizedVol`: Should match market conditions
- `spreadZ`: Should spike during news/low liquidity
- `isOverlap`: Should be true during London-NY overlap
- `drawdownPct`: Monitor for safety trigger (5%)
- `f_session`: Correct session classification
- `f_vol`: Reasonable vol adjustment (0.5-1.5 range)
- `f_spread`: Penalty during wide spreads
- `f_news`: Scaling during events
- `f_dd`: Drawdown protection active

---

## Troubleshooting

### stats.json not updating
- **Symptom**: stats.json shows stale timestamp
- **Cause**: Bot not integrated or stats population code missing
- **Fix**: Implement stats.json population in bot cycle

### Risk multiplier NaN/Inf
- **Symptom**: Audit logs show invalid values
- **Cause**: Division by zero or invalid input data
- **Fix**: Fail-open triggered, restore to base config
- **Prevention**: Add input validation (eps guards)

### Excessive fluctuation
- **Symptom**: risk.multiplier changing too frequently
- **Cause**: halfLifeMin too low or minEffectThreshold too small
- **Fix**: Increase halfLifeMin (20→30) or threshold (0.05→0.10)

### No factor response
- **Symptom**: risk.multiplier doesn't change despite market conditions
- **Cause**: All deltas below minEffectThreshold (0.05)
- **Check**: Audit logs for computed vs applied values
- **Action**: Normal behavior - threshold prevents over-trading

---

## File Locations

```
config/
├── active.json                      # Live config (unchanged in shadow mode)
├── base.json                        # Base preset config
├── .backup/
│   └── 20251022_deployment/
│       └── active.json.bak          # Pre-deployment backup
└── runtime/
    ├── policy.json                  # ← Risk engine schema
    ├── stats.json                   # ← Populated by bot each cycle
    ├── DEPLOYMENT_STATUS.json       # ← Deployment tracking
    ├── RISK_ENGINE_DRY_RUN_REPORT.md
    ├── README.md                    # ← This file
    └── audit/
        ├── dry_run_2025_10_22.json
        └── <timestamp>.json         # ← Live audit logs
```

---

## Support

### Documentation
- `RISK_ENGINE_DRY_RUN_REPORT.md`: Comprehensive dry-run analysis
- `DEPLOYMENT_STATUS.json`: Current phase and status
- `audit/*.json`: Detailed calculation logs

### Schema Reference
- `policy.json`: Risk engine configuration
- `stats.json`: Runtime statistics template

### Contact
- Issues: Review audit logs for errors
- Questions: Check RISK_ENGINE_DRY_RUN_REPORT.md first
- Modifications: Edit policy.json instrument parameters

---

**orchestratorStamp**: hs-session-kgz@1.0.0
**Status**: DEPLOYED (Shadow Mode)
**Last Updated**: 2025-10-22
