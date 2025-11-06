Jadecap Strategy Bot — Phase4o4 Strict Mode

Overview
- Adds an optional strict mode to trade only a single pattern: liquidity sweep → MSS (market structure shift) → OTE (62–79% retracement) tap.
- Gating enforces: MSS present, OTE present, sequence order (sweep then MSS), retest-to-FOI, killzone timing, and no counter‑trend entries.

How to Use
- Build in cTrader Automate (5.4.9 build 44110): Automate > Build.
- Parameters (Strategy group): set `Enable Phase4o4 strict mode` to true (default).
- Backtest via Automate > Backtest and export results into `backtests/<symbol>_<tf>_<yyyymmdd>.cset`.

What Strict Mode Enforces
- Require MSS and OTE together; no entries without both.
- Enforce sequence: recent opposite-side sweep then MSS in entry direction.
- Entry strictly via OTE only; OB/FVG are ignored for entries.
- Retest to FOI and minimum pullback after break.
- Killzone gate enabled (use Kill Zone Start/End hours to control session).
- Disable counter‑trend flow; align MSS with higher‑timeframe bias.

Recommended Defaults
- MinRiskReward: 2.0; Min SL Floor: 5 pips; ATR sanity: enabled (ATR 14, factor 0.25).
- Risk Percent: 1.0%; Max Concurrent Positions: 1–2.

Folders
- `docs/` — notes and presets.
- `backtests/` — export cTrader backtest runs here.
- `data/` — market data samples, if any.

Notes
- This code does not ship broker credentials or compiled `.algo` binaries.
- If you change money management or entry gates, please backtest and attach the equity curve in PRs.

Recent additions from frames
- Intraday Bias: Day-open sweep + 15m shift gate, and discount/premium entry enforcement.
- Weekly Accumulation: Mon/Tue range sweep + 5m shift direction filter; optional use of the range boundary as TP.
- Ping-Pong assist: when enabled, compact range boundaries are considered as TP candidates alongside liquidity zones.
- POI validity: optional key-level interaction check (PDH/PDL/CDH/CDL/EQH/EQL/PWH/PWL) with tolerance in pips.
- Internal liquidity: require internal sweeps only, and an optional TP focus on internal boundaries.
- Entry presets: Model A (MSS+OTE), Model B (MSS+IFVG), Model C (Breaker+IFVG).
- Visuals: Mon/Tue overlay box (toggle), internal sweep labels (toggle), and colorized key-level labels (PD/Weekly/EQ/CD colors). POI validity draws a small ✓ marker on the tapped POI when the key-level rule is met.


Time Zones
- If your server time differs from your trading session time (e.g., server UTC, session NY), set Session TZ offset vs server (hours). Example: NY session on a UTC server: -5 (EST) or -4 (EDT).

Presets
- docs/presets/phase4o4_ny_strict.json: strict NY session with Killzone 9:30–11:30 and session TZ offset -5. Import these values into the parameter panel as needed.

