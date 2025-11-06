Phase4o4 Shorts Alignment Guide

Use this checklist to align the bot with specific Shorts. Each section lists the parameters to toggle. All names match the cTrader UI labels in JadecapStrategy.cs.

Always Try To Mark The Accumulation Then Wait For Manipulation (PO3)
- Enable PO3 (Asia sweep gating): true
- Asia Start (HH:mm): 00:00 (EST)
- Asia End (HH:mm): 05:00 (EST)
- Require Asia sweep before entry: true
- Require PDH/PDL sweeps only: true (optional; use EQH/EQL/CDH/CDL if you prefer)
- Include PDH/PDL as liquidity zones: true

Learn The Logic Of Movements, PO3 Intraday
- Same as above; keep Strict Mode ON and OTE‑only entries.
- Kill Zone Start/End (Hours EST): 9.5 / 11.5 (or your session)
- Enable Killzone Gate: true

Intraday Trading (Killzones)
- Enable Killzone Gate: true
- Kill Zone Start/End (Hours EST): set for your session(s)
- Optional: enable London/NY session overrides (MSS Sessions) if needed.

Simple Way To Identify The Trend
- Bias TF (Pro‑Trend): Hour or Day (or Week if you prefer weekly)
- Use Counter‑Trend Bias: false
- Align MSS With Bias: true

Live Trading News (If you trade news)
- Enable News Blackout: false (to allow trades around news)
- If you want to avoid news: Enable News Blackout: true; set Blackout windows

3 Confirmation Method (MSS + Breaker + IFVG)
- Require MSS+Breaker+IFVG: true
- Require MSS to Enter: true
- POI Priority: OTE (keep OTE‑only entries)
- Enable FVG Drawing: true (optional for visuals)

Easy Setup For Beginners
- Enable Phase4o4 strict mode: true
- Require PDH/PDL sweeps only: false (optional)
- Require MSS+Breaker+IFVG: false (keep MSS+OTE only)

PingPong Trading Style (Range)
- Enable PingPong (range mode): true
- PingPong max range (pips): 30 (tune per symbol)
- PingPong min bounce (pips): 5–10
- Include Equal High/Low zones: true
- Include Current Day H/L: true
- Require PDH/PDL sweeps only: false
- Enable Sequence Gate: false (optional in range mode)

One Of The Most Powerful Confirmation (SMT)
- Enable SMT divergence: true
- SMT Compare Symbol: e.g., US500 (compare with US100), or DXY for FX majors
- SMT TimeFrame: Hour (or match your chart)
- SMT as filter (block opposite): true
- SMT pivot (swings): 2–3

Asia Session Liquidity
- Include Equal High/Low zones: true (to detect Asia equal highs/lows)
- Include Current Day H/L: true
- Enable PO3 (Asia sweep gating): true
- Require Asia sweep before entry: true

Mechanical Trading Setup (Easy and Simple)
- Enable Phase4o4 strict mode: true
- Require MSS to Enter: true
- Require OTE always: true
- Require OTE if available: true
- Require PDH/PDL sweeps only: true
- Enable Killzone Gate: true (set times)

Follow The Weekly Profile (Trend)
- Bias TF (Pro‑Trend): Day or Week
- Align MSS With Bias: true
- Include Weekly H/L zones: true (PWH/PWL)
- Allow Weekly sweeps: true (unless you want PDH/PDL only)

General Disable Tips (if not in the video)
- News Blackout: set to false
- SMT divergence: set to false
- PingPong (range mode): set to false
- Include Weekly H/L zones: set to false
- Allow EQH/EQL/CDH/CDL/Weekly sweeps: set the corresponding Allow* parameters to false
- Require PDH/PDL sweeps only: set to true for strict PD sweeps only

Presets
- See docs/presets for ready‑to‑load parameter sets.



## Unified Presets (Video Alignment)
- **NY_Strict_InternalOnly** → EntryGateMode=MSS_and_OTE, OtePolicy=StrictAfterMSS, SweepScope=Internal_Only, TpTargetPolicy=OppositeLiquidity, Session=NY, BiasAlign=Strict
- **PostNews_Continuation** → EntryGateMode=MSS_and_OTE, OtePolicy=ContinuationReanchor, SweepScope=Any, TpTargetPolicy=OppositeLiquidity, NewsFilter=AllowOnlyPostNews(Delay=3m), BiasAlign=Strict
- **Asia_Liquidity_Sweep** → EntryGateMode=MSSOnly, OtePolicy=IfAvailable, SweepScope=PDH_PDL_Only, TpTargetPolicy=InternalBoundary, Session=Asia, BiasAlign=Loose

### Triple sequence (strict)
When `EntryGateMode=Triple` and `StrictSequence=true`, entry additionally requires **SWEEP + MSS + (BREAKER ∧ IFVG)** before allowing OTE.


- **NY_Strict_TripleSequence** → EntryGateMode=Triple, StrictSequence=true, OtePolicy=StrictAfterMSS, SweepScope=Any, TpTargetPolicy=OppositeLiquidity, Session=NY, BiasAlign=Strict

- **London_Triple_Strict** → EntryGateMode=Triple, StrictSequence=true, OtePolicy=StrictAfterMSS, SweepScope=Any, TpTargetPolicy=OppositeLiquidity, Session=London, BiasAlign=Strict, NewsFilter=Off
- **Weekly_Focused** → EntryGateMode=MSS_and_OTE, StrictSequence=true, OtePolicy=StrictAfterMSS, SweepScope=Weekly_Only, TpTargetPolicy=WeeklyHighLow, BiasAlign=Strict

- **London_Weekly_Focused** → EntryGateMode=MSS_and_OTE, StrictSequence=true, OtePolicy=StrictAfterMSS, SweepScope=Weekly_Only, TpTargetPolicy=WeeklyHighLow, Session=London, BiasAlign=Strict
- **NY_Weekly_Focused** → EntryGateMode=MSS_and_OTE, StrictSequence=true, OtePolicy=StrictAfterMSS, SweepScope=Weekly_Only, TpTargetPolicy=WeeklyHighLow, Session=NY, BiasAlign=Strict

- **Asia_Weekly_Focused** → EntryGateMode=MSS_and_OTE, StrictSequence=true, OtePolicy=StrictAfterMSS, SweepScope=Weekly_Only, TpTargetPolicy=WeeklyHighLow, Session=Asia, BiasAlign=Strict
