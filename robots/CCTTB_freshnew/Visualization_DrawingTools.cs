using System;
using System.Collections.Generic;
using System.Linq;
using cAlgo.API;
using cAlgo.API.Internals;

namespace CCTTB
{
    public class DrawingTools
    {
        private readonly Robot _robot;
        private readonly Chart _chart;
        private readonly StrategyConfig _config;

        private readonly Dictionary<string, Queue<string>> _gc = new Dictionary<string, Queue<string>>();

        // caps come from StrategyConfig (with safe fallbacks)
        private int CapSwing => Math.Max(1, _config?.MaxSwingLines ?? 16);
        private int CapLiq => Math.Max(1, _config?.MaxLiquidityLines ?? 16);
        private int CapMss => Math.Max(1, _config?.MaxMssLines ?? 6);
        private int CapOte => Math.Max(1, _config?.MaxOTEBoxes ?? 4);
        private int CapOb => Math.Max(1, _config?.MaxOBBoxes ?? 8);
        private int CapPd => Math.Max(1, _config?.MaxPDObjects ?? 4);
        private const int CapMsg = 1;
        private int CapFvg => Math.Max(1, _config?.MaxFVGBoxes ?? 6);
        private bool ShowLabels => _config?.ShowBoxLabels ?? true;

        public DrawingTools(Robot robot, Chart chart, StrategyConfig config)
        {
            _robot = robot;
            _chart = chart;
            _config = config;
        }

        // ---------- utils ----------
        private void Track(string bucket, string id, int cap)
        {
            if (!_gc.TryGetValue(bucket, out var q))
            {
                q = new Queue<string>();
                _gc[bucket] = q;
            }
            q.Enqueue(id);
            while (q.Count > cap)
            {
                var old = q.Dequeue();
                try { _chart.RemoveObject(old); } catch { }
            }
        }
        private string C(string bucket, string slug) => $"{bucket}_{slug}";

        // ---------- Bias (with timeframe label) ----------
        public void DrawBiasStatus(BiasDirection bias, TimeFrame tf)
        {
            const string id = "INFO_BIAS";
            string text = $"Bias: {bias}  [{tf}]";
            Color color = bias == BiasDirection.Bullish ? _config.BullishColor
                        : bias == BiasDirection.Bearish ? _config.BearishColor
                        : Color.Gray;

            try { _chart.RemoveObject(id); } catch { }
            _chart.DrawStaticText(id, text, VerticalAlignment.Top, HorizontalAlignment.Left, color);
        }

        // ---------- Swings from LiquidityZones as lines ----------
        public void DrawSwingLinesFromZones(List<LiquidityZone> zones, double mergePips = 2.0)
        {
            if (zones == null || zones.Count == 0) return;

            double pip = _robot.Symbol.PipSize;
            var deDup = new HashSet<int>();
            int drawn = 0;

            foreach (var z in zones.OrderByDescending(z => z.Start))
            {
                double price = z.Type == LiquidityZoneType.Demand ? z.Low : z.High;
                int keyBucket = (int)Math.Round(price / (pip * Math.Max(1e-9, mergePips)));
                if (deDup.Contains(keyBucket)) continue;
                deDup.Add(keyBucket);

                var color = (z.Type == LiquidityZoneType.Demand) ? Color.SeaGreen : Color.Tomato;
                string id = C("SWING", $"{z.Start.Ticks}_{(z.Type == LiquidityZoneType.Demand ? "D" : "S")}");
                _chart.DrawHorizontalLine(id, price, color, 1, LineStyle.Solid);
                Track("SWING", id, CapSwing);

                string label = string.IsNullOrWhiteSpace(z.Label) ? (z.Bullish ? "Swing Low" : "Swing High") : z.Label;
                _chart.DrawText(id + "_L", label, z.Start, price, color);
                Track("SWING", id + "_L", CapSwing);

                if (++drawn >= CapSwing) break;
            }
        }

        // ---------- Optional: raw liquidity levels as lines ----------
        public void DrawLiquidityLines(IEnumerable<(DateTime t, double price, bool bullish, string label)> levels)
        {
            if (levels == null) return;
            int i = 0;
            foreach (var lv in levels)
            {
                var color = lv.bullish ? _config.BullishColor : _config.BearishColor;
                string id = C("LIQ", $"{lv.t.Ticks}_{i++}");
                _chart.DrawHorizontalLine(id, lv.price, color, 1, LineStyle.Dots);
                _chart.DrawText(id + "_L", lv.label ?? "LQ", lv.t, lv.price, color);
                Track("LIQ", id, CapLiq);
                Track("LIQ", id + "_L", CapLiq);
                if (i >= CapLiq) break;
            }
        }

        // ---------- PDH / PDL (+ PD EQ50 line) ----------
        public void DrawPDH_PDL(bool drawEq50 = true)
        {
            if (!TryGetPrevDayLevels(out double pdh, out double pdl, out double eq, out DateTime t0))
                return;

            var cH = _config.PDHColor;
            var cL = _config.PDLColor;
            var cE = _config.Eq50Color;

            string idH = C("PD", $"H_{t0.Ticks}");
            string idL = C("PD", $"L_{t0.Ticks}");

            _chart.DrawHorizontalLine(idH, pdh, cH, 1, LineStyle.Solid);
            _chart.DrawHorizontalLine(idL, pdl, cL, 1, LineStyle.Solid);
            _chart.DrawText(idH + "_L", "PDH", t0, pdh, cH);
            _chart.DrawText(idL + "_L", "PDL", t0, pdl, cL);

            Track("PD", idH, CapPd); Track("PD", idH + "_L", CapPd);
            Track("PD", idL, CapPd); Track("PD", idL + "_L", CapPd);

            if (drawEq50)
            {
                string idE = C("PD", $"EQ_{t0.Ticks}");
                _chart.DrawHorizontalLine(idE, eq, cE, 1, LineStyle.Dots);
                _chart.DrawText(idE + "_L", "PD EQ50", t0, eq, cE);
                Track("PD", idE, CapPd);
                Track("PD", idE + "_L", CapPd);
            }
        }

        // Expose PD levels
        public bool TryGetPrevDayLevels(out double pdh, out double pdl, out double eq, out DateTime dayOpenTime)
        {
            pdh = pdl = eq = 0; dayOpenTime = default;
            try
            {
                var d = _robot.MarketData.GetBars(TimeFrame.Daily);
                if (d == null || d.Count < 3) return false;
                int i = d.Count - 2; // last CLOSED day
                pdh = d.HighPrices[i];
                pdl = d.LowPrices[i];
                eq = (pdh + pdl) * 0.5;
                dayOpenTime = d.OpenTimes[i];
                return true;
            }
            catch { return false; }
        }

        // ---------- Sweeps ----------
        public void DrawSweeps(List<LiquiditySweep> sweeps, double? pdh = null, double? pdl = null)
        {
            if (sweeps == null || sweeps.Count == 0) return;

            double tol = _robot.Symbol.PipSize * 2; // within 2 pips counts as a PDH/PDL sweep
            int i = 0;

            foreach (var s in sweeps.OrderByDescending(x => x.Time))
            {
                var color = s.IsBullish ? _config.BullishColor : _config.BearishColor;
                string id = C("SWP", $"{s.Time.Ticks}_{i++}");

                _chart.DrawIcon(id, ChartIconType.Circle, s.Time, s.Price, color);
                Track("SWP", id, CapLiq);

                string txt = s.IsBullish ? "Sell-side sweep" : "Buy-side sweep";
                // Prefer explicit label when present
                if (!string.IsNullOrWhiteSpace(s.Label))
                {
                    var L = s.Label.Trim().ToUpperInvariant();
                    bool isPd = L == "PDH" || L == "PDL";
                    bool isEq = L == "EQH" || L == "EQL";
                    bool isWk = L == "PWH" || L == "PWL";
                    bool isCd = L == "CDH" || L == "CDL";
                    if (isPd || isEq || isWk || isCd)
                        txt = L + " Sweep";
                    else if (L.Contains("SWING") && (_config.ShowInternalSweepLabels))
                        txt = "Internal Sweep";
                }
                if (pdh.HasValue && Math.Abs(s.Price - pdh.Value) <= tol) txt = "PDH Sweep";
                if (pdl.HasValue && Math.Abs(s.Price - pdl.Value) <= tol) txt = "PDL Sweep";

                double y = s.Price + (s.IsBullish ? tol : -tol);
                Color textColor = color;
                if (_config.ColorizeKeyLevelLabels)
                {
                    if (txt.StartsWith("PD")) textColor = _config.KeyColorPD;
                    else if (txt.StartsWith("PWH") || txt.StartsWith("PWL")) textColor = _config.KeyColorWK;
                    else if (txt.StartsWith("EQ")) textColor = _config.KeyColorEQ;
                    else if (txt.StartsWith("CD")) textColor = _config.KeyColorCD;
                }
                _chart.DrawText(id + "_L", txt, s.Time, y, textColor);
                Track("SWP", id + "_L", CapLiq);

                if (i >= CapLiq) break;
            }
        }

        // Mark a POI validity (e.g., key-level overlap) with a small icon near the zone's mid-price.
        public void MarkPoiValidation(DateTime tRef, double low, double high, string label, bool isValid)
        {
            try
            {
                double mid = (low + high) * 0.5;
                string id = C("POI", $"VAL_{tRef.Ticks}_{mid:F5}");
                var c = isValid ? Color.SeaGreen : Color.Tomato;
                _chart.DrawIcon(id, ChartIconType.Diamond, tRef, mid, c);
                if (ShowLabels)
                {
                    _chart.DrawText(id + "_L", label + (isValid ? " ✓" : " ✗"), tRef, mid, c);
                    Track("POI", id + "_L", 8);
                }
                Track("POI", id, 8);
            }
            catch { }
        }

        // ---------- Mon/Tue weekly accumulation range ----------
        public void DrawMonTueRange(DateTime tStart, DateTime tEnd, double low, double high)
        {
            try
            {
                string id = C("WMON", $"{tStart.Ticks}");
                var edge = Color.FromArgb(30, _config.Eq50Color.R, _config.Eq50Color.G, _config.Eq50Color.B);
                _chart.DrawRectangle(id, tStart, high, tEnd, low, edge);
                Track("WMON", id, 2);
                if (ShowLabels)
                {
                    _chart.DrawText(id + "_L", "Mon/Tue Range", tStart, (low + high) * 0.5, _config.Eq50Color);
                    Track("WMON", id + "_L", 2);
                }
            }
            catch { }
        }

        public void DrawKeyLegend(VerticalAlignment v = VerticalAlignment.Top, HorizontalAlignment h = HorizontalAlignment.Right)
        {
            if (!_config.ColorizeKeyLevelLabels) return;
            const string id = "INFO_KEYS";
            string legend = "Keys: PD=gold, WK=purple, EQ=slate, CD=gray";
            try { _chart.RemoveObject(id); } catch { }
            _chart.DrawStaticText(id, legend, v, h, Color.Gray);
        }

        // ---------- Summary line (top-center) ----------
        public void DrawSummary(string text, VerticalAlignment v, HorizontalAlignment h, Color overrideColor = null)
        {
            const string id = "INFO_SUMMARY";
            var c = overrideColor ?? Color.Gray;
            try { _chart.RemoveObject(id); } catch { }
            _chart.DrawStaticText(id, text ?? string.Empty, v, h, c);
        }

                // ---------- Day Open vertical line ----------
        public void DrawDayOpen(DateTime dayOpen)
        {
            try
            {
                string id = C("DO", $"{dayOpen.Ticks}");
                _chart.DrawVerticalLine(id, dayOpen, Color.Gray, 1, LineStyle.Dots);
                Track("DO", id, CapPd);
                if (ShowLabels)
                {
                    _chart.DrawText(id + "_L", "Day Open", dayOpen, _robot.Symbol.Bid, Color.Gray);
                    Track("DO", id + "_L", CapPd);
                }
            }
            catch { }
        }

        // ---------- Generic session range box ----------
        public void DrawSessionRange(DateTime tStart, DateTime tEnd, double low, double high, string label)
        {
            var edge = Color.FromArgb(24, _config.Eq50Color.R, _config.Eq50Color.G, _config.Eq50Color.B);
            DrawSessionRange(tStart, tEnd, low, high, label, edge);
        }

        public void DrawSessionRange(DateTime tStart, DateTime tEnd, double low, double high, string label, Color edge)
        {
            try
            {
                string id = C("SESS", $"{tStart.Ticks}_{label}");
                _chart.DrawRectangle(id, tStart, high, tEnd, low, edge);
                Track("SESS", id, 3);
                if (ShowLabels)
                {
                    _chart.DrawText(id + "_L", label, tStart, (low + high) * 0.5, edge);
                    Track("SESS", id + "_L", 3);
                }
            }
            catch { }
        }
        // ---------- Current Day High/Low ----------
        public void DrawCurrentDayHL()
        {
            try
            {
                var b = _robot.Bars; if (b == null || b.Count < 2) return;
                DateTime d0 = _robot.Server.Time.Date;
                double hi = double.MinValue, lo = double.MaxValue;
                int startIdx = 0;
                for (int i = 0; i < b.Count; i++) { if (b.OpenTimes[i] >= d0) { startIdx = i; break; } }
                for (int i = startIdx; i < b.Count; i++) { if (b.HighPrices[i] > hi) hi = b.HighPrices[i]; if (b.LowPrices[i] < lo) lo = b.LowPrices[i]; }
                if (hi == double.MinValue || lo == double.MaxValue) return;
                string idH = C("CD", $"H_{d0.Ticks}");
                string idL = C("CD", $"L_{d0.Ticks}");
                _chart.DrawHorizontalLine(idH, hi, _config.BullishColor, 1, LineStyle.Dots);
                _chart.DrawHorizontalLine(idL, lo, _config.BearishColor, 1, LineStyle.Dots);
                if (ShowLabels)
                {
                    _chart.DrawText(idH + "_L", "CDH", d0, hi, _config.BullishColor);
                    _chart.DrawText(idL + "_L", "CDL", d0, lo, _config.BearishColor);
                }
                Track("CD", idH, CapPd); Track("CD", idL, CapPd);
            }
            catch { }
        }

        // ---------- Killzone boundaries ----------
        public void DrawKillZoneBounds(DateTime start, DateTime end)
        {
            try
            {
                string idS = C("KZ", $"S_{start.Ticks}");
                string idE = C("KZ", $"E_{end.Ticks}");
                _chart.DrawVerticalLine(idS, start, Color.Gray, 1, LineStyle.Dots);
                _chart.DrawVerticalLine(idE, end, Color.Gray, 1, LineStyle.Dots);
                if (ShowLabels)
                {
                    _chart.DrawText(idS + "_L", "KZ Start", start, _robot.Symbol.Bid, Color.Gray);
                    _chart.DrawText(idE + "_L", "KZ End",   end,   _robot.Symbol.Bid, Color.Gray);
                }
                Track("KZ", idS, 4); Track("KZ", idE, 4);
            }
            catch { }
        }        // ---------- BOS / MSS break marker ----------
        public void DrawBOS(MSSSignal sig)
        {
            if (!_config.ShowBOSArrows || sig == null) return;
            try
            {
                string id = C("BOS", $"{sig.Time.Ticks}");
                var c = (sig.Direction == BiasDirection.Bullish) ? _config.BullishColor : _config.BearishColor;
                _chart.DrawIcon(id, ChartIconType.Diamond, sig.Time, sig.Price, c);
                if (ShowLabels)
                {
                    string lbl = sig.Direction == BiasDirection.Bullish ? "BOS↑" : "BOS↓";
                    _chart.DrawText(id + "_L", lbl, sig.Time, sig.Price, c);
                    Track("BOS", id + "_L", 10);
                }
                Track("BOS", id, 10);
            }
            catch { }
        }

        // ---------- Impulse Discount/Premium zones ----------
        public void DrawImpulseZones(MSSSignal sig, int minutes = 20)
        {
            if (!_config.ShowImpulseZones || sig == null) return;
            try
            {
                double a = sig.ImpulseStart; double b = sig.ImpulseEnd;
                double lo = Math.Min(a, b); double hi = Math.Max(a, b);
                double eq = (lo + hi) * 0.5;
                DateTime t0 = sig.Time; DateTime t1 = t0.AddMinutes(Math.Max(5, minutes));
                string idD = C("IMP", $"D_{t0.Ticks}");
                string idP = C("IMP", $"P_{t0.Ticks}");
                var cD = Color.FromArgb(24, _config.BullishColor.R, _config.BullishColor.G, _config.BullishColor.B);
                var cP = Color.FromArgb(24, _config.BearishColor.R, _config.BearishColor.G, _config.BearishColor.B);
                if (sig.Direction == BiasDirection.Bullish)
                {
                    // Bullish: discount = [lo, eq], premium = [eq, hi]
                    _chart.DrawRectangle(idD, t0, eq, t1, lo, cD); Track("IMP", idD, 4);
                    _chart.DrawRectangle(idP, t0, hi, t1, eq, cP); Track("IMP", idP, 4);
                }
                else if (sig.Direction == BiasDirection.Bearish)
                {
                    // Bearish: premium = [eq, hi], discount = [lo, eq] (colors swapped to convey contrarian)
                    _chart.DrawRectangle(idP, t0, hi, t1, eq, cP); Track("IMP", idP, 4);
                    _chart.DrawRectangle(idD, t0, eq, t1, lo, cD); Track("IMP", idD, 4);
                }
                // EQ line label
                string idEQ = C("IMP", $"EQ_{t0.Ticks}");
                _chart.DrawHorizontalLine(idEQ, eq, _config.Eq50Color, 1, LineStyle.Dots);
                if (ShowLabels)
                {
                    _chart.DrawText(idEQ + "_L", "EQ", t0, eq, _config.Eq50Color); Track("IMP", idEQ + "_L", 4);
                }
                Track("IMP", idEQ, 4);
            }
            catch { }
        }

        // ---------- Liquidity side labels (PDH/PDL as Buy/Sell Side) ----------
        public void DrawLiquiditySideLabels(double? pdh, double? pdl, DateTime anchor)
        {
            if (!_config.ShowLiquiditySideLabels) return;
            try
            {
                if (pdh.HasValue)
                {
                    string id = C("LQS", $"BS_{anchor.Ticks}");
                    _chart.DrawText(id, "Buy-Side", anchor, pdh.Value, _config.BullishColor);
                    Track("LQS", id, CapPd);
                }
                if (pdl.HasValue)
                {
                    string id = C("LQS", $"SS_{anchor.Ticks}");
                    _chart.DrawText(id, "Sell-Side", anchor, pdl.Value, _config.BearishColor);
                    Track("LQS", id, CapPd);
                }
            }
            catch { }
        }// ---------- MSS ----------
        public void DrawMSS(List<MSSSignal> signals)
        {
            if (signals == null || signals.Count == 0) return;
            int i = 0;
            // Show all MSS signals as they are prerequisites/confirmations
            foreach (var m in signals.OrderByDescending(s => s.Time))
            {
                var color = (m.Direction == BiasDirection.Bullish) ? _config.BullishColor : _config.BearishColor;
                string id = C("MSS", $"{m.Time.Ticks}_{i++}");
                _chart.DrawHorizontalLine(id, m.Price, color, 2, LineStyle.Solid);
                _chart.DrawText(id + "_L", "MSS", m.Time, m.Price, color);
                Track("MSS", id, CapMss);
                Track("MSS", id + "_L", CapMss);
                if (i >= CapMss) break;
            }
        }

        // ---------- Bias swings overlay (for validation) ----------
        public void DrawBiasSwings(TimeFrame tf, int pivot = 3)
        {
            try
            {
                var bars = _robot.MarketData.GetBars(tf);
                if (bars == null || bars.Count < pivot * 2 + 3) return;

                int end = bars.Count - pivot - 2; // last closed window
                int start = Math.Max(pivot, end - 150);

                // Collect recent swings (keep order: most-recent first)
                var swingHighs = new List<(int idx, double price, DateTime t)>();
                var swingLows  = new List<(int idx, double price, DateTime t)>();
                for (int i = end; i >= start && (swingHighs.Count < 6 || swingLows.Count < 6); i--)
                {
                    bool isHigh = true, isLow = true;
                    for (int k = 1; k <= pivot; k++)
                    {
                        if (bars.HighPrices[i] <= bars.HighPrices[i - k] || bars.HighPrices[i] <= bars.HighPrices[i + k]) isHigh = false;
                        if (bars.LowPrices[i] >= bars.LowPrices[i - k] || bars.LowPrices[i] >= bars.LowPrices[i + k]) isLow = false;
                        if (!isHigh && !isLow) break;
                    }
                    if (isHigh) swingHighs.Add((i, bars.HighPrices[i], bars.OpenTimes[i]));
                    if (isLow)  swingLows.Add((i, bars.LowPrices[i],  bars.OpenTimes[i]));
                }

                // Determine structure from latest two
                string structTxt = "Indecisive"; Color structColor = Color.Gray;
                int? recentHighIdx = null, recentLowIdx = null;
                if (swingHighs.Count >= 2 && swingLows.Count >= 2)
                {
                    var ph1 = swingHighs[0]; var ph0 = swingHighs[1];
                    var pl1 = swingLows[0];  var pl0 = swingLows[1];
                    bool hh = ph1.price > ph0.price + 1e-9;
                    bool hl = pl1.price > pl0.price + 1e-9;
                    bool lh = ph1.price < ph0.price - 1e-9;
                    bool ll = pl1.price < pl0.price - 1e-9;

                    if (hh && hl) { structTxt = "HH/HL"; structColor = _config.BullishColor; recentHighIdx = ph1.idx; recentLowIdx = pl1.idx; }
                    else if (lh && ll) { structTxt = "LH/LL"; structColor = _config.BearishColor; recentHighIdx = ph1.idx; recentLowIdx = pl1.idx; }
                }

                // Draw up to N swings with labels on the most recent pair
                int drawnH = 0, drawnL = 0; int cap = 8;
                foreach (var h in swingHighs.Take(cap))
                {
                    string id = C("BIAS_SW", $"H_{tf}_{h.t.Ticks}");
                    _chart.DrawIcon(id, ChartIconType.Diamond, h.t, h.price, _config.BearishColor);
                    Track("BIAS_SW", id, 10);
                    if (recentHighIdx.HasValue && h.idx == recentHighIdx.Value)
                    {
                        _chart.DrawText(id + "_L", structTxt.StartsWith("HH") ? "HH" : "LH", h.t, h.price, structColor);
                        Track("BIAS_SW", id + "_L", 10);
                    }
                    if (++drawnH >= cap) break;
                }
                foreach (var l in swingLows.Take(cap))
                {
                    string id = C("BIAS_SW", $"L_{tf}_{l.t.Ticks}");
                    _chart.DrawIcon(id, ChartIconType.Square, l.t, l.price, _config.BullishColor);
                    Track("BIAS_SW", id, 10);
                    if (recentLowIdx.HasValue && l.idx == recentLowIdx.Value)
                    {
                        _chart.DrawText(id + "_L", structTxt.EndsWith("HL") ? "HL" : "LL", l.t, l.price, structColor);
                        Track("BIAS_SW", id + "_L", 10);
                    }
                    if (++drawnL >= cap) break;
                }

                // Compact HUD label for structure
                string sid = C("BIAS_SW", $"STRUCT_{tf}");
                try { _chart.RemoveObject(sid); } catch { }
                _chart.DrawStaticText(sid, $"Structure: {structTxt}", VerticalAlignment.Top, HorizontalAlignment.Right, structColor);
            }
            catch { }
        }

        // ---------- FOI / FVG (optional helper) ----------
        public void DrawFVG(DateTime t0, double low, double high, int boxMinutes = 30, Color overrideColor = default(Color))
        {
            var c = overrideColor == default(Color) ? (_config?.FVGColor ?? Color.Goldenrod) : overrideColor;
            double lo = Math.Min(low, high);
            double hi = Math.Max(low, high);

            string id = C("FVG", $"{t0.Ticks}_{lo:F5}_{hi:F5}");
            _chart.DrawRectangle(id, t0, hi, t0.AddMinutes(boxMinutes), lo, c);
            Track("FVG", id, CapFvg);
            if (ShowLabels)
            {
                _chart.DrawText(id + "_L", "FVG", t0, (lo + hi) * 0.5, c);
                Track("FVG", id + "_L", CapFvg);
            }
        }

        // ---------- OTE boxes (+ swing EQ50 and fib lines) ----------
        public void DrawOTE(
            List<OTEZone> zones,
            int boxMinutes = 45,
            bool drawEq50 = true,
            BiasDirection? mssDirection = null,
            bool enforceDailyEqSide = true)
        {
            if (!_config.EnablePOIBoxDraw || zones == null || zones.Count == 0) return;

            // Optional: daily EQ50 side enforcement (bullish: below; bearish: above)
            double? pdEq = null;
            if (enforceDailyEqSide && mssDirection.HasValue)
            {
                if (TryGetPrevDayLevels(out var _, out var __, out var eq, out _))
                    pdEq = eq;
            }

            int iBox = 0;
            foreach (var o in zones.OrderByDescending(z => z.Time))
            {
                var c = (o.Direction == BiasDirection.Bullish) ? _config.BullishColor : _config.BearishColor;

                // Draw OTE box from 0.618 to 0.79 strictly
                double lo = Math.Min(o.OTE618, o.OTE79);
                double hi = Math.Max(o.OTE618, o.OTE79);

                // Enforce daily EQ side if requested
                if (pdEq.HasValue)
                {
                    if (mssDirection == BiasDirection.Bullish && !(hi < pdEq.Value)) continue; // BELOW PD EQ
                    if (mssDirection == BiasDirection.Bearish && !(lo > pdEq.Value)) continue; // ABOVE PD EQ
                }

                string id = C("OTE", $"{o.Time.Ticks}_{iBox}");
                _chart.DrawRectangle(id, o.Time, hi, o.Time.AddMinutes(boxMinutes), lo, c);
                Track("OTE", id, CapOte);

                if (drawEq50)
                {
                    // OTE mid (mid of 0.618-0.79 band)
                    double mid = (lo + hi) * 0.5;
                    _chart.DrawHorizontalLine(id + "_MID", mid, c, 1, LineStyle.Dots);
                    if (ShowLabels)
                    {
                        _chart.DrawText(id + "_MIDL", "OTE Mid", o.Time, mid, c);
                        Track("OTE", id + "_MIDL", CapOte);
                    }
                    Track("OTE", id + "_MID", CapOte);

                    // Swing EQ50 (mid of impulse start/end) as full-width reference
                    double swingEq = (o.ImpulseStart + o.ImpulseEnd) * 0.5;
                    _chart.DrawHorizontalLine(id + "_EQ50", swingEq, _config.Eq50Color, 1, LineStyle.Solid);
                    _chart.DrawText(id + "_EQ50L", "EQ50", o.Time, swingEq, _config.Eq50Color);
                    Track("OTE", id + "_EQ50", CapOte);
                    Track("OTE", id + "_EQ50L", CapOte);

                    // Draw inner fib edges for clarity
                    _chart.DrawHorizontalLine(id + "_618", o.OTE618, c, 1, LineStyle.Dots);
                    _chart.DrawHorizontalLine(id + "_786", o.OTE79,  c, 1, LineStyle.Dots);
                    Track("OTE", id + "_618", CapOte);
                    Track("OTE", id + "_786", CapOte);
                }

                // Label the zone type
                if (ShowLabels)
                {
                    string zl = o.Direction == BiasDirection.Bullish ? "OTE Bullish" : "OTE Bearish";
                    _chart.DrawText(id + "_LBL", zl, o.Time, (lo + hi) * 0.5, c);
                    Track("OTE", id + "_LBL", CapOte);
                }

                if (++iBox >= CapOte) break;
            }
        }

        // ---------- Enhanced OTE with Full Fibonacci Levels ----------
        public void DrawOTEWithFibonacci(
            List<OTEZone> zones,
            int boxMinutes = 45,
            bool showFibRetracements = true,
            bool showFibExtensions = false,
            bool showPriceLabels = true,
            bool show236 = false,
            bool show382 = false,
            bool show500 = true,
            bool show618 = true,
            bool show786 = true,
            bool show886 = false)
        {
            if (!_config.EnablePOIBoxDraw || zones == null || zones.Count == 0) return;

            int iBox = 0;
            foreach (var o in zones.OrderByDescending(z => z.Time))
            {
                var c = (o.Direction == BiasDirection.Bullish) ? _config.BullishColor : _config.BearishColor;

                // MSS impulse swing
                double swingLow = Math.Min(o.ImpulseStart, o.ImpulseEnd);
                double swingHigh = Math.Max(o.ImpulseStart, o.ImpulseEnd);
                bool isBull = o.Direction == BiasDirection.Bullish;

                // OTE box (61.8% - 78.6%)
                double oteTop = Math.Max(o.OTE618, o.OTE79);
                double oteBot = Math.Min(o.OTE618, o.OTE79);

                string baseId = C("OTEFIB", $"{o.Time.Ticks}_{iBox}");

                // Draw OTE box
                _chart.DrawRectangle(baseId + "_BOX", o.Time, oteTop, o.Time.AddMinutes(boxMinutes), oteBot, c);
                Track("OTEFIB", baseId + "_BOX", CapOte);

                if (ShowLabels)
                {
                    _chart.DrawText(baseId + "_LBL", "OTE", o.Time, (oteTop + oteBot) * 0.5, c);
                    Track("OTEFIB", baseId + "_LBL", CapOte);
                }

                if (showFibRetracements)
                {
                    // Draw Fibonacci retracement levels
                    // 0% = swing extreme (high for bearish, low for bullish)
                    // 100% = swing start (low for bearish, high for bullish)

                    double fib0 = isBull ? swingHigh : swingLow;    // 0% (impulse end)
                    double fib100 = isBull ? swingLow : swingHigh;  // 100% (impulse start)

                    // Always draw 0% and 100%
                    DrawFibLevel(baseId, "0", fib0, o.Time, c, showPriceLabels, LineStyle.Solid);
                    DrawFibLevel(baseId, "100", fib100, o.Time, c, showPriceLabels, LineStyle.Solid);

                    // Optional levels
                    if (show236)
                    {
                        double fib236 = Fibonacci.GetLevel(fib100, fib0, Fibonacci.Levels.Fib236);
                        DrawFibLevel(baseId, "23.6", fib236, o.Time, c, showPriceLabels);
                    }

                    if (show382)
                    {
                        double fib382 = Fibonacci.GetLevel(fib100, fib0, Fibonacci.Levels.Fib382);
                        DrawFibLevel(baseId, "38.2", fib382, o.Time, c, showPriceLabels);
                    }

                    if (show500)
                    {
                        double fib50 = Fibonacci.GetLevel(fib100, fib0, Fibonacci.Levels.Fib500);
                        DrawFibLevel(baseId, "50.0", fib50, o.Time, _config.Eq50Color, showPriceLabels);
                    }

                    if (show618)
                    {
                        DrawFibLevel(baseId, "61.8", o.OTE618, o.Time, c, showPriceLabels);
                    }

                    if (show786)
                    {
                        DrawFibLevel(baseId, "78.6", o.OTE79, o.Time, c, showPriceLabels);
                    }

                    if (show886)
                    {
                        double fib886 = Fibonacci.GetLevel(fib100, fib0, Fibonacci.Levels.Fib886);
                        DrawFibLevel(baseId, "88.6", fib886, o.Time, c, showPriceLabels);
                    }
                }

                if (showFibExtensions)
                {
                    // Draw Fibonacci extensions beyond the swing
                    double range = Math.Abs(swingHigh - swingLow);

                    // Extensions go beyond the impulse end
                    // For bullish: above the high
                    // For bearish: below the low

                    if (isBull)
                    {
                        // Bullish extensions ABOVE swing high
                        double ext127 = swingHigh + (range * 0.272); // 1.272 - 1.0 = 0.272
                        double ext162 = swingHigh + (range * 0.618); // 1.618 - 1.0 = 0.618
                        double ext200 = swingHigh + range;           // 2.0 - 1.0 = 1.0
                        double ext262 = swingHigh + (range * 1.618); // 2.618 - 1.0 = 1.618

                        DrawFibLevel(baseId, "EXT_1.272", ext127, o.Time, Color.LightGreen, showPriceLabels, LineStyle.DotsVeryRare);
                        DrawFibLevel(baseId, "EXT_1.618", ext162, o.Time, Color.LightGreen, showPriceLabels, LineStyle.DotsVeryRare);
                        DrawFibLevel(baseId, "EXT_2.0", ext200, o.Time, Color.LightGreen, showPriceLabels, LineStyle.DotsVeryRare);
                        DrawFibLevel(baseId, "EXT_2.618", ext262, o.Time, Color.LightGreen, showPriceLabels, LineStyle.DotsVeryRare);
                    }
                    else
                    {
                        // Bearish extensions BELOW swing low
                        double ext127 = swingLow - (range * 0.272);
                        double ext162 = swingLow - (range * 0.618);
                        double ext200 = swingLow - range;
                        double ext262 = swingLow - (range * 1.618);

                        DrawFibLevel(baseId, "EXT_1.272", ext127, o.Time, Color.LightCoral, showPriceLabels, LineStyle.DotsVeryRare);
                        DrawFibLevel(baseId, "EXT_1.618", ext162, o.Time, Color.LightCoral, showPriceLabels, LineStyle.DotsVeryRare);
                        DrawFibLevel(baseId, "EXT_2.0", ext200, o.Time, Color.LightCoral, showPriceLabels, LineStyle.DotsVeryRare);
                        DrawFibLevel(baseId, "EXT_2.618", ext262, o.Time, Color.LightCoral, showPriceLabels, LineStyle.DotsVeryRare);
                    }
                }

                if (++iBox >= CapOte) break;
            }
        }

        // Helper method to draw a single Fibonacci level line with optional label
        private void DrawFibLevel(
            string baseId,
            string levelName,
            double price,
            DateTime startTime,
            Color color,
            bool showLabel,
            LineStyle style = LineStyle.Dots)
        {
            string lineId = baseId + $"_FIB_{levelName}";
            _chart.DrawHorizontalLine(lineId, price, color, 1, style);
            Track("OTEFIB", lineId, CapOte);

            if (showLabel && ShowLabels)
            {
                string labelId = lineId + "_L";
                string labelText = $"{levelName}% ({price:F5})";
                _chart.DrawText(labelId, labelText, startTime, price, color);
                Track("OTEFIB", labelId, CapOte);
            }
        }

        // ---------- Order Blocks ----------
        public void DrawOrderBlocks(List<OrderBlock> blocks, int boxMinutes = 30)
        {
            if (blocks == null || blocks.Count == 0) return;

            int i = 0;
            foreach (var ob in blocks.OrderByDescending(b => b.Time))
            {
                var edge = (ob.Direction == BiasDirection.Bullish) ? _config.BullishColor : _config.BearishColor;
                string id = C("OB", $"{ob.Time.Ticks}_{i++}");

                _chart.DrawRectangle(id, ob.Time, ob.HighPrice, ob.Time.AddMinutes(boxMinutes), ob.LowPrice, edge);
                if (ShowLabels)
                {
                    _chart.DrawText(id + "_L", "OB", ob.Time, (ob.LowPrice + ob.HighPrice) * 0.5, edge);
                    Track("OB", id + "_L", CapOb);
                }
                Track("OB", id, CapOb);
                if (i >= CapOb) break;
            }
        }
        
        public void DrawOBBox(DateTime t0, double low, double high, int minutesSpan, string idPrefix, Color colorOverride = default(Color))
        {
            var c = colorOverride == default(Color) ? Color.FromArgb(40, 0, 128, 255) : colorOverride;
            string id = C(idPrefix, $"{t0.Ticks}_{low:F5}_{high:F5}");
            _chart.DrawRectangle(id, t0, high, t0.AddMinutes(minutesSpan), low, c);
            Track(idPrefix, id, 30);
        }

        public void DrawBreakerBlocks(List<BreakerBlock> blocks, int boxMinutes = 30)
        {
            if (blocks == null || blocks.Count == 0) return;

            int i = 0;
            foreach (var b in blocks.OrderByDescending(b => b.Time))
            {
                var edge = (b.Direction == BiasDirection.Bullish) ? _config.BreakerColor : _config.BreakerColor;
                string id = C("BRK", $"{b.Time.Ticks}_{i++}");
                _chart.DrawRectangle(id, b.Time, b.HighPrice, b.Time.AddMinutes(boxMinutes), b.LowPrice, edge);
                Track("BRK", id, Math.Max(1, _config.MaxBreakerBoxes));
                if (ShowLabels)
                {
                    _chart.DrawText(id + "_L", "BRK", b.Time, (b.LowPrice + b.HighPrice) * 0.5, edge);
                    Track("BRK", id + "_L", Math.Max(1, _config.MaxBreakerBoxes));
                }
                if (i >= _config.MaxBreakerBoxes) break;
            }
        }

        public void DrawSequenceObOverlay(DateTime t0, double low, double high, int minutesSpan, Color color)
        {
            string id = C("SEQOB", $"{t0.Ticks}_{low:F5}_{high:F5}");
            _chart.DrawRectangle(id, t0, high, t0.AddMinutes(minutesSpan), low, color);
            Track("SEQOB", id, Math.Max(1, _config.MaxOBBoxes));
            if (ShowLabels)
            {
                _chart.DrawText(id + "_L", "SEQ OB", t0, (low + high) * 0.5, color);
                Track("SEQOB", id + "_L", Math.Max(1, _config.MaxOBBoxes));
            }
            // label already tracked above when present
        }

        public void DrawSweepOteOverlay(List<OTEZone> zones, Color color, int boxMinutes = 30)
        {
            if (zones == null || zones.Count == 0) return;
            int i = 0;
            foreach (var o in zones.OrderByDescending(z => z.Time))
            {
                double lo = Math.Min(o.OTE618, o.OTE79);
                double hi = Math.Max(o.OTE618, o.OTE79);
                string id = C("SOTE", $"{o.Time.Ticks}_{i++}");
                _chart.DrawRectangle(id, o.Time, hi, o.Time.AddMinutes(boxMinutes), lo, color);
                Track("SOTE", id, CapOte);
                _chart.DrawText(id + "_L", "S-OTE", o.Time, (lo + hi) * 0.5, color);
                Track("SOTE", id + "_L", CapOte);
                if (i >= CapOte) break;
            }
        }

        // ---------- Fib/EQ/OTE pack from an MSS signal ----------
        public void DrawFibPackFromMSS(MSSSignal sig, int minutes = 45)
        {
            if (sig == null) return;

            bool isBull = sig.Direction == BiasDirection.Bullish;
            double a = sig.ImpulseStart;
            double b = sig.ImpulseEnd;
            if (a == 0 && b == 0) return;

            var c = isBull ? _config.BullishColor : _config.BearishColor;
            var id = C("FP", sig.Time.Ticks.ToString());

            // EQ50 of the impulse
            double eq = (a + b) * 0.5;
            _chart.DrawHorizontalLine(id + "_EQ", eq, _config.Eq50Color, 1, LineStyle.Solid);
            _chart.DrawText(id + "_EQL", "EQ50", sig.Time, eq, _config.Eq50Color);
            Track("FP", id + "_EQ", CapOte);
            Track("FP", id + "_EQL", CapOte);

            // OTE band from 0.618..0.79
            var zone = Fibonacci.CalculateOTEZone(a, b, isBull);
            double lo = Math.Min(zone.Low, zone.High);
            double hi = Math.Max(zone.Low, zone.High);
            _chart.DrawRectangle(id + "_OTE", sig.Time, hi, sig.Time.AddMinutes(minutes), lo, c);
            Track("FP", id + "_OTE", CapOte);

            // OTE mid
            double mid = (lo + hi) * 0.5;
            _chart.DrawHorizontalLine(id + "_MID", mid, c, 1, LineStyle.Dots);
            _chart.DrawText(id + "_MIDL", "OTE Mid", sig.Time, mid, c);
            Track("FP", id + "_MID", CapOte);
            Track("FP", id + "_MIDL", CapOte);
        }

        // ---------- Entry Signal Markers ----------
        public void DrawEntrySignal(TradeSignal signal)
        {
            if (signal == null) return;
            try
            {
                bool isBuy = signal.StopLoss < signal.EntryPrice;
                var color = isBuy ? _config.BullishColor : _config.BearishColor;
                var iconType = isBuy ? ChartIconType.UpArrow : ChartIconType.DownArrow;

                string id = C("ENTRY", $"{signal.Timestamp.Ticks}_{signal.EntryPrice:F5}");

                // Draw arrow at entry price
                _chart.DrawIcon(id, iconType, signal.Timestamp, signal.EntryPrice, color);
                Track("ENTRY", id, 10);

                if (ShowLabels)
                {
                    string label = $"{signal.Label ?? "Entry"} {(isBuy ? "BUY" : "SELL")}";
                    double labelOffset = _robot.Symbol.PipSize * (isBuy ? -3 : 3);
                    _chart.DrawText(id + "_L", label, signal.Timestamp, signal.EntryPrice + labelOffset, color);
                    Track("ENTRY", id + "_L", 10);
                }
            }
            catch { }
        }
    }
}



