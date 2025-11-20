# Backtesting Presets (cTrader) — EURUSD

**Commission model:** `USD per 1 mln USD volume`
**Commission value:** `60`  (≈ $6 per 100k round-trip on IC Markets Raw)

## Preset A — EURUSD_Tight_0.0_0.2
- Spread: **Random**
  - Min: **0.0 pip**
  - Max: **0.2 pip**
- Notes: Overlap-like conditions; optimistic fill/latency.

## Preset B — EURUSD_Base_0.2_1.2
- Spread: **Random**
  - Min: **0.2 pip**
  - Max: **1.2 pip**
- Notes: Realistic day-wide profile for IC Markets Raw.

---

### Suggested ranges for other symbols (reference)
- **XAUUSD (points):** Tight 10–15, Base 15–30
- **US30 (points):**  Tight 1–2,   Base 2–4

### How to use in cTrader Backtesting
1) Set **Commission type** to `USD per 1 mln USD volume` and value to `60`.
2) Set **Spread** to `Random` with the Min/Max above.
3) Save each as a preset with the names below.

**Preset names to save in the GUI:**
- `EURUSD_Tight_0.0_0.2`
- `EURUSD_Base_0.2_1.2`
