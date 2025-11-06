// File: Data_MarketDataProvider.cs
using System;
using System.Collections.Generic;
using cAlgo.API;
using cAlgo.API.Internals;
using System.Linq;

namespace CCTTB
{
    // NOTE: BiasDirection enum must be defined ONCE elsewhere in this namespace:
    // public enum BiasDirection { Bearish, Neutral, Bullish }

    public class MarketDataProvider
    {
        private readonly Robot _bot;
        private readonly MarketData _md;
        private readonly Symbol _symbol;
        private readonly StrategyConfig _cfg;

        private TimeFrame _biasTf;
        private Bars _biasBars;

        private BiasDirection _lastBias = BiasDirection.Neutral;
        private readonly Dictionary<TimeFrame, BiasDirection> _lastBiasByTf = new Dictionary<TimeFrame, BiasDirection>();
        private readonly Dictionary<TimeFrame, BiasDirection?> _lastProposedByTf = new Dictionary<TimeFrame, BiasDirection?>();
        private readonly Dictionary<TimeFrame, int> _streakByTf = new Dictionary<TimeFrame, int>();
        private BiasDirection? _lastProposedCurrTf = null;
        private int _streakCurrTf = 0;

        // Zones cache (declare ONCE)
        private readonly List<LiquidityZone> _zones = new List<LiquidityZone>();

        public MarketDataProvider(Robot bot, MarketData md, Symbol symbol, StrategyConfig cfg)
        {
            _bot = bot;
            _md = md;
            _symbol = symbol;
            _cfg = cfg;

            _biasTf = _cfg?.BiasTimeFrame ?? TimeFrame.Hour;
            try { _biasBars = _md.GetBars(_biasTf); } catch { _biasBars = null; }
        }
        private readonly Dictionary<TimeFrame, Bars> _barsCache = new Dictionary<TimeFrame, Bars>();

        public Bars GetBars(TimeFrame tf)
        {
            if (!_barsCache.TryGetValue(tf, out var s))
            {
                s = _md.GetBars(tf);
                _barsCache[tf] = s;
            }
            return s;
        }

        public void UpdateData()
        {
            // Rebind if timeframe changed at runtime
            if (_cfg == null) return;
            if (_biasBars == null || _biasBars.TimeFrame != _cfg.BiasTimeFrame)
            {
                _biasTf = _cfg.BiasTimeFrame;
                try { _biasBars = _md.GetBars(_biasTf); } catch { _biasBars = null; }
            }
            // Bars auto-update in cTrader; no manual refresh required
        }

        /// <summary>
        /// Robust HTF bias:
        /// - Uses last CLOSED bars (Count-2 and older), not the forming bar (Count-1).
        /// - Swing-structure rule: compare the most recent two swing highs and lows.
        /// - If both highs and lows step up -> Bullish; both step down -> Bearish; else keep previous bias.
        /// </summary>
        public BiasDirection GetCurrentBias()
        {
            if (_biasBars == null || _biasBars.Count < 10)
                return _lastBias; // not enough data yet

            var raw = ComputeRawBiasSignal(_biasBars);
            if (raw == null)
                return _lastBias;

            if (raw == _lastBias)
            {
                _lastProposedCurrTf = raw; _streakCurrTf = _cfg?.BiasConfirmationBars ?? 2;
                return _lastBias;
            }

            if (_lastProposedCurrTf == raw)
                _streakCurrTf++;
            else
            {
                _lastProposedCurrTf = raw;
                _streakCurrTf = 1;
            }

            int need = Math.Max(1, _cfg?.BiasConfirmationBars ?? 2);
            if (_streakCurrTf >= need)
            {
                _lastBias = raw.Value;
                return _lastBias;
            }
            return _lastBias;
        }

        public BiasDirection GetBias(TimeFrame tf)
        {
            var bars = GetBars(tf);
            var prev = _lastBiasByTf.TryGetValue(tf, out var pb) ? pb : BiasDirection.Neutral;
            var raw = ComputeRawBiasSignal(bars);
            if (raw == null)
            {
                _lastBiasByTf[tf] = prev; return prev;
            }
            if (raw == prev)
            {
                _lastProposedByTf[tf] = raw; _streakByTf[tf] = _cfg?.BiasConfirmationBars ?? 2;
                _lastBiasByTf[tf] = prev; return prev;
            }
            var lastProp = _lastProposedByTf.TryGetValue(tf, out var lp) ? lp : null;
            var streak = _streakByTf.TryGetValue(tf, out var st) ? st : 0;
            if (lastProp == raw) streak++; else { lastProp = raw; streak = 1; }
            int need = Math.Max(1, _cfg?.BiasConfirmationBars ?? 2);
            if (streak >= need)
            {
                _lastBiasByTf[tf] = raw.Value;
                _lastProposedByTf[tf] = raw; _streakByTf[tf] = streak;
                return raw.Value;
            }
            _lastProposedByTf[tf] = raw; _streakByTf[tf] = streak; _lastBiasByTf[tf] = prev; return prev;
        }

        /// <summary>
        /// Adaptive pivot based on timeframe for better intraday structure detection.
        /// M5=2 (10min swings), M15=3 (45min), H1=4 (4hr), H4=5 (20hr)
        /// </summary>
        private static int GetAdaptivePivot(TimeFrame tf)
        {
            string tfStr = tf?.ToString() ?? "Hour";
            return tfStr switch
            {
                "Minute5"  => 2,  // M5: 10 minute swings (responsive intraday)
                "Minute15" => 3,  // M15: 45 minute swings
                "Hour"     => 4,  // H1: 4 hour swings
                "Hour4"    => 5,  // H4: 20 hour swings
                _          => 3   // default for other timeframes
            };
        }

        private static bool IsSwingHigh(Bars b, int idx, int pivot)
        {
            for (int k = 1; k <= pivot; k++)
            {
                if (idx - k < 0 || idx + k >= b.Count) return false;
                if (b.HighPrices[idx] <= b.HighPrices[idx - k] || b.HighPrices[idx] <= b.HighPrices[idx + k]) return false;
            }
            return true;
        }

        private static bool IsSwingLow(Bars b, int idx, int pivot)
        {
            for (int k = 1; k <= pivot; k++)
            {
                if (idx - k < 0 || idx + k >= b.Count) return false;
                if (b.LowPrices[idx] >= b.LowPrices[idx - k] || b.LowPrices[idx] >= b.LowPrices[idx + k]) return false;
            }
            return true;
        }

        private BiasDirection? ComputeRawBiasSignal(Bars bars)
        {
            if (bars == null || bars.Count < 10) return null;

            // Use adaptive pivot based on timeframe (M5=2, M15=3, H1=4, H4=5)
            int pivot = GetAdaptivePivot(bars.TimeFrame);
            int start = Math.Max(pivot, bars.Count - 150);
            int end = bars.Count - pivot - 2; // use closed bars only

            var swingHighs = new List<(int idx, double price)>();
            var swingLows  = new List<(int idx, double price)>();

            // Find 3 swing highs and 3 swing lows for stronger confirmation
            for (int i = end; i >= start; i--)
            {
                if (IsSwingHigh(bars, i, pivot)) swingHighs.Add((i, bars.HighPrices[i]));
                if (IsSwingLow(bars, i, pivot))  swingLows.Add((i, bars.LowPrices[i]));
                if (swingHighs.Count >= 3 && swingLows.Count >= 3) break;
            }

            if (swingHighs.Count < 3 || swingLows.Count < 3) return null;

            // Compare 3 swings (indices: 0=most recent, 1=2nd recent, 2=3rd recent)
            var ph0 = swingHighs[0].price; // Most recent swing high
            var ph1 = swingHighs[1].price; // 2nd recent swing high
            var ph2 = swingHighs[2].price; // 3rd recent swing high

            var pl0 = swingLows[0].price;  // Most recent swing low
            var pl1 = swingLows[1].price;  // 2nd recent swing low
            var pl2 = swingLows[2].price;  // 3rd recent swing low

            // Require 2 consecutive higher highs for bullish (stronger confirmation)
            bool hh1 = ph0 > ph1 + 1e-9; // Recent HH
            bool hh2 = ph1 > ph2 + 1e-9; // Previous HH

            // Require 2 consecutive higher lows for bullish
            bool hl1 = pl0 > pl1 + 1e-9; // Recent HL
            bool hl2 = pl1 > pl2 + 1e-9; // Previous HL

            // Require 2 consecutive lower highs for bearish (stronger confirmation)
            bool lh1 = ph0 < ph1 - 1e-9; // Recent LH
            bool lh2 = ph1 < ph2 - 1e-9; // Previous LH

            // Require 2 consecutive lower lows for bearish
            bool ll1 = pl0 < pl1 - 1e-9; // Recent LL
            bool ll2 = pl1 < pl2 - 1e-9; // Previous LL

            // Bullish: Both HH sequences AND both HL sequences must be true
            if (hh1 && hh2 && hl1 && hl2) return BiasDirection.Bullish;

            // Bearish: Both LH sequences AND both LL sequences must be true
            if (lh1 && lh2 && ll1 && ll2) return BiasDirection.Bearish;

            return null; // No clear trend (keep previous bias)
        }

        /// <summary>
        /// Builds simple swing-based liquidity zones so downstream sweep/POI logic has input.
        /// </summary>
        public void UpdateLiquidityZones()
        {
            var bars = _bot?.Bars;
            if (bars == null || bars.Count < 20) return;

            // Rebuild recent zones each bar (simple & robust)
            _zones.Clear();

            int lookbackBars = 120;                 // scan window
            int pivot = 3;                          // swing pivot left/right
            int start = Math.Max(pivot, bars.Count - lookbackBars);
            int end = bars.Count - pivot - 1;

            double pad = _bot.Symbol.PipSize * 2;   // small band around pivot

            for (int i = start; i <= end; i++)
            {
                bool isHigh = true, isLow = true;

                for (int k = 1; k <= pivot; k++)
                {
                    if (bars.HighPrices[i] <= bars.HighPrices[i - k] || bars.HighPrices[i] <= bars.HighPrices[i + k]) isHigh = false;
                    if (bars.LowPrices[i] >= bars.LowPrices[i - k] || bars.LowPrices[i] >= bars.LowPrices[i + k]) isLow = false;
                    if (!isHigh && !isLow) break;
                }

                if (isHigh)
                {
                    _zones.Add(new LiquidityZone
                    {
                        Start = bars.OpenTimes[i],
                        End = bars.OpenTimes[i].AddMinutes(240), // extend to the right
                        Low = bars.HighPrices[i] - pad,
                        High = bars.HighPrices[i] + pad,
                        Type = LiquidityZoneType.Supply,
                        Label = "Swing High"
                    });
                }
                else if (isLow)
                {
                    _zones.Add(new LiquidityZone
                    {
                        Start = bars.OpenTimes[i],
                        End = bars.OpenTimes[i].AddMinutes(240),
                        Low = bars.LowPrices[i] - pad,
                        High = bars.LowPrices[i] + pad,
                        Type = LiquidityZoneType.Demand,
                        Label = "Swing Low"
                    });
                }
            }

            // Equal Highs / Lows (relative equal highs/lows within tolerance)
            // IMPORTANT: Remove EQH/EQL zones if broken (closed through without reversal)
            try
            {
                if (_cfg != null && _cfg.IncludeEqualHighsLowsAsZones)
                {
                    double tol = Math.Max(0.0, _cfg.EqTolerancePips) * _symbol.PipSize;
                    int look = Math.Max(5, _cfg.EqLookbackBars);
                    int from = Math.Max(1, bars.Count - look);
                    var eqh = new HashSet<long>();
                    var eql = new HashSet<long>();
                    // Use rounded price key to avoid duplicates
                    long Key(double price) => (long)Math.Round(price / (_symbol.PipSize * 0.1));

                    // Equal Highs
                    for (int i = from + 2; i < bars.Count - 1; i++)
                    {
                        for (int j = Math.Max(from, i - 20); j <= i - 2; j++)
                        {
                            if (Math.Abs(bars.HighPrices[i] - bars.HighPrices[j]) <= tol)
                            {
                                double ph = (bars.HighPrices[i] + bars.HighPrices[j]) * 0.5;
                                long k = Key(ph);
                                if (!eqh.Contains(k))
                                {
                                    // Check if EQH has been BROKEN (closed above without reversal)
                                    bool broken = false;
                                    for (int b = i + 1; b < bars.Count; b++)
                                    {
                                        // Broken = close above EQH (not just wick above)
                                        if (bars.ClosePrices[b] > ph + tol)
                                        {
                                            broken = true;
                                            break;
                                        }
                                    }

                                    // Only add EQH if NOT broken (still valid)
                                    if (!broken)
                                    {
                                        _zones.Add(new LiquidityZone
                                        {
                                            Start = bars.OpenTimes[j],
                                            End = bars.OpenTimes[i].AddMinutes(240),
                                            Low = ph - tol,
                                            High = ph + tol,
                                            Type = LiquidityZoneType.Supply,
                                            Label = "EQH"
                                        });
                                    }
                                    eqh.Add(k);
                                }
                                break;
                            }
                        }
                    }
                    // Equal Lows
                    for (int i = from + 2; i < bars.Count - 1; i++)
                    {
                        for (int j = Math.Max(from, i - 20); j <= i - 2; j++)
                        {
                            if (Math.Abs(bars.LowPrices[i] - bars.LowPrices[j]) <= tol)
                            {
                                double pl = (bars.LowPrices[i] + bars.LowPrices[j]) * 0.5;
                                long k = Key(pl);
                                if (!eql.Contains(k))
                                {
                                    // Check if EQL has been BROKEN (closed below without reversal)
                                    bool broken = false;
                                    for (int b = i + 1; b < bars.Count; b++)
                                    {
                                        // Broken = close below EQL (not just wick below)
                                        if (bars.ClosePrices[b] < pl - tol)
                                        {
                                            broken = true;
                                            break;
                                        }
                                    }

                                    // Only add EQL if NOT broken (still valid)
                                    if (!broken)
                                    {
                                        _zones.Add(new LiquidityZone
                                        {
                                            Start = bars.OpenTimes[j],
                                            End = bars.OpenTimes[i].AddMinutes(240),
                                            Low = pl - tol,
                                            High = pl + tol,
                                            Type = LiquidityZoneType.Demand,
                                            Label = "EQL"
                                        });
                                    }
                                    eql.Add(k);
                                }
                                break;
                            }
                        }
                    }
                }
            }
            catch { }

            // Optionally include previous day high/low as liquidity zones
            try
            {
                if (_cfg != null && _cfg.IncludePrevDayLevelsAsZones)
                {
                    var dBars = GetBars(TimeFrame.Daily);
                    if (dBars != null && dBars.Count >= 2)
                    {
                        int pdIdx = dBars.Count - 2; // last closed daily bar
                        double pdh = dBars.HighPrices[pdIdx];
                        double pdl = dBars.LowPrices[pdIdx];
                        double padPd = _symbol.PipSize * 1.0;
                        var pdStart = dBars.OpenTimes[pdIdx].AddDays(1); // effective on current day
                        var pdEnd = pdStart.AddDays(1);

                        // PDH as supply zone
                        _zones.Add(new LiquidityZone
                        {
                            Start = pdStart,
                            End = pdEnd,
                            Low = pdh - padPd,
                            High = pdh + padPd,
                            Type = LiquidityZoneType.Supply,
                            Label = "PDH"
                        });
                        // PDL as demand zone
                        _zones.Add(new LiquidityZone
                        {
                            Start = pdStart,
                            End = pdEnd,
                            Low = pdl - padPd,
                            High = pdl + padPd,
                            Type = LiquidityZoneType.Demand,
                            Label = "PDL"
                        });
                    }
                }
            }
            catch { }

            // Optionally include current day high/low as liquidity zones
            try
            {
                if (_cfg != null && _cfg.IncludeCurrentDayLevelsAsZones)
                {
                    // Use bars' date; compute today's range up to now
                    var lastTime = bars.OpenTimes[bars.Count - 1];
                    var day = lastTime.Date;
                    double dayHigh = double.MinValue;
                    double dayLow = double.MaxValue;
                    DateTime dayStartTime = DateTime.MinValue;
                    DateTime dayEndTime = DateTime.MinValue;
                    for (int i = Math.Max(1, bars.Count - 500); i < bars.Count; i++)
                    {
                        if (bars.OpenTimes[i].Date != day) continue;
                        if (dayStartTime == DateTime.MinValue) dayStartTime = bars.OpenTimes[i];
                        dayEndTime = bars.OpenTimes[i];
                        dayHigh = Math.Max(dayHigh, bars.HighPrices[i]);
                        dayLow = Math.Min(dayLow, bars.LowPrices[i]);
                    }
                    if (dayStartTime != DateTime.MinValue)
                    {
                        double padCd = _symbol.PipSize * 1.0;
                        // CDH supply
                        _zones.Add(new LiquidityZone
                        {
                            Start = dayStartTime,
                            End = dayEndTime.AddHours(4),
                            Low = dayHigh - padCd,
                            High = dayHigh + padCd,
                            Type = LiquidityZoneType.Supply,
                            Label = "CDH"
                        });
                        // CDL demand
                        _zones.Add(new LiquidityZone
                        {
                            Start = dayStartTime,
                            End = dayEndTime.AddHours(4),
                            Low = dayLow - padCd,
                            High = dayLow + padCd,
                            Type = LiquidityZoneType.Demand,
                            Label = "CDL"
                        });
                    }
                }
            }
            catch { }

            // Optionally include previous week high/low as liquidity zones
            try
            {
                if (_cfg != null && _cfg.IncludeWeeklyLevelsAsZones)
                {
                    var wBars = GetBars(TimeFrame.Weekly);
                    if (wBars != null && wBars.Count >= 2)
                    {
                        int pwIdx = wBars.Count - 2; // last closed weekly
                        double pwh = wBars.HighPrices[pwIdx];
                        double pwl = wBars.LowPrices[pwIdx];
                        double padW = _symbol.PipSize * 2.0;
                        var wStart = wBars.OpenTimes[pwIdx].AddDays(7); // effective this week
                        var wEnd = wStart.AddDays(7);
                        _zones.Add(new LiquidityZone
                        {
                            Start = wStart,
                            End = wEnd,
                            Low = pwh - padW,
                            High = pwh + padW,
                            Type = LiquidityZoneType.Supply,
                            Label = "PWH"
                        });
                        _zones.Add(new LiquidityZone
                        {
                            Start = wStart,
                            End = wEnd,
                            Low = pwl - padW,
                            High = pwl + padW,
                            Type = LiquidityZoneType.Demand,
                            Label = "PWL"
                        });
                    }
                }
            }
            catch { }

            // Keep most recent N zones to avoid clutter
            const int maxZones = 14;
            if (_zones.Count > maxZones)
                _zones.RemoveRange(0, _zones.Count - maxZones);
        }

        public List<LiquidityZone> GetLiquidityZones() => _zones;

        // --- Helper methods used by TradeManager ---
        public (double Price, string Source) GetOppositeLiquidityLevels(bool forBuy)
        {
            // Return a best-effort opposite-side liquidity level (price) from cached zones
            try
            {
                if (_zones == null || _zones.Count == 0) return (0, null);
                // For buy trades, opposite liquidity is supply (Supply zones)
                var type = forBuy ? LiquidityZoneType.Supply : LiquidityZoneType.Demand;
                var found = _zones.Where(z => z.Type == type).OrderBy(z => Math.Abs((z.Low+z.High)/2 - (_bot?.Symbol.Bid ?? 0))).FirstOrDefault();
                if (found != null) return (((found.Low + found.High) * 0.5), found.Label);
            }
            catch { }
            return (0, null);
        }

        public (double TargetPrice, string Label) GetWeeklyHighLow(bool forBuy)
        {
            try
            {
                var w = GetBars(TimeFrame.Weekly);
                if (w == null || w.Count < 2) return (0, null);
                int idx = w.Count - 2; // last closed
                double price = forBuy ? w.HighPrices[idx] : w.LowPrices[idx];
                return (price, forBuy ? "PWH" : "PWL");
            }
            catch { }
            return (0, null);
        }

        public (double Price, string Source) GetNearestInternalBoundary(bool forBuy)
        {
            try
            {
                if (_zones == null || _zones.Count == 0) return (0, null);
                // internal boundaries meaning non-PD/week CD/EQ; prefer closest internal zone
                var candidates = _zones.Where(z => !(z.Label == "PDH" || z.Label == "PDL" || z.Label == "PWH" || z.Label == "PWL"));
                if (!candidates.Any()) return (0, null);
                var found = candidates.OrderBy(z => Math.Abs((z.Low + z.High)/2 - (_bot?.Symbol.Bid ?? 0))).FirstOrDefault();
                if (found != null) return (((found.Low + found.High) * 0.5), found.Label);
            }
            catch { }
            return (0, null);
        }
    }
}
