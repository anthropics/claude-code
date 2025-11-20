Phase4o4 Strict Pattern

Entry Pattern
- Opposite-side liquidity sweep (relative equal highs/lows or prior day high/low).
- Market Structure Shift (MSS) in the intended direction.
- Retracement into the OTE 62–79% zone and tap.

Bot Enforcement (Strict Mode)
- `RequireMSSandOTE` gate in EntryConfirmation: both tags must be present.
- Sequence gate: sweep must precede MSS within a recent window.
- Entry source limited to OTE; other POIs are ignored for entries.
- Retest-to-FOI required; optional micro-break and pullback gates stay enabled.
- Killzone gate enabled (use parameter hours to select session).

Risk/TP
- Stop below/above POI with small buffer and ATR sanity floor.
- Take-profit can target opposite liquidity with minimum RR >= configured threshold.

Usage
- Keep `Enable Phase4o4 strict mode = true`.
- Adjust Kill Zone hours and Bias TF to match your session.

