using System;
using System.Collections.Generic;
using CCTTB.MSS.Core.Maths;          // ATR

namespace CCTTB.MSS.Core.Detectors
{
    public class NewBaseType
    {
        // Expose the event publicly for subscribers, but provide a protected
        // raiser so derived types can raise it. Use the project's canonical
        // root MSSSignal type (defined in CCTTB namespace) which other modules consume.
        public event Action<global::CCTTB.MSSSignal> OnSignal;

        // Derived classes should call this to raise the event.
        protected void RaiseOnSignal(global::CCTTB.MSSSignal sig)
        {
            OnSignal?.Invoke(sig);
        }
    }


    public class MSSDetector : NewBaseType
    {
        private readonly MSSConfig _cfg;
        private readonly ATR _atr;

        private readonly List<DateTime> _times = new List<DateTime>();
        private readonly List<double> _opens  = new List<double>();
        private readonly List<double> _highs  = new List<double>();
        private readonly List<double> _lows   = new List<double>();
        private readonly List<double> _closes = new List<double>();

        public MSSDetector(MSSConfig cfg, int atrPeriod = 14)
        {
            _cfg = cfg ?? new MSSConfig();
            _atr = new ATR(atrPeriod);
        }

        public void OnBar(DateTime time, double open, double high, double low, double close,
                          bool htfBiasIsBullish, bool inKillzone, bool hadSweepFlag)
        {
            _times.Add(time); _opens.Add(open); _highs.Add(high); _lows.Add(low); _closes.Add(close);
            _atr.Step(high, low, close);

            int i = _closes.Count - 1;
            if (i < 3 || !_atr.IsReady) return;
            if (!inKillzone) return;

            // ---- swings: respect configured lookback (pivot width) ----
            int pivot = Math.Max(1, _cfg.SwingLookback);
            int lastSwingHi = SwingDetector.LastSwingHighBefore(_highs, i, pivot: pivot);
            int lastSwingLo = SwingDetector.LastSwingLowBefore(_lows,  i, pivot: pivot);
            if (lastSwingHi < 0 || lastSwingLo < 0) return;

            // Break of structure
            if (_closes[i] > _highs[lastSwingHi])
                EvaluateMSS(i, MSSType.Bullish, lastSwingHi, htfBiasIsBullish, hadSweepFlag);

            if (_closes[i] < _lows[lastSwingLo])
                EvaluateMSS(i, MSSType.Bearish, lastSwingLo, htfBiasIsBullish, hadSweepFlag);
        }

        private void EvaluateMSS(int i, MSSType type, int refSwingIndex, bool htfBiasIsBullish, bool hadSweepFlag)
        {
            double range = Math.Max(_highs[i] - _lows[i], 1e-9);
            double body  = Math.Abs(_closes[i] - _opens[i]);
            double bodyRatio = body / range;
            if (bodyRatio < _cfg.MinBodyRatio) return;

            double refLevel = (type == MSSType.Bullish) ? _highs[refSwingIndex] : _lows[refSwingIndex];
            double displacement = Math.Abs(_closes[i] - refLevel);
            double atrThresh = _cfg.MinDisplacementATR * _atr.Value;
            double medThresh = 0.0;
            if (_cfg.UseMedianDisplacement)
            {
                int mw = Math.Max(3, _cfg.DisplacementMedianWindow);
                int start = Math.Max(1, i - mw);
                var trs = new System.Collections.Generic.List<double>();
                for (int k = start; k < i; k++)
                {
                    double tr = Math.Max(_highs[k] - _lows[k], Math.Max(Math.Abs(_highs[k] - _closes[k - 1]), Math.Abs(_lows[k] - _closes[k - 1])));
                    trs.Add(tr);
                }
                if (trs.Count > 0)
                {
                    trs.Sort();
                    double median = (trs.Count % 2 == 1) ? trs[trs.Count/2] : 0.5*(trs[trs.Count/2-1]+trs[trs.Count/2]);
                    medThresh = _cfg.DisplacementMedianFactor * median;
                }
            }
            double req = System.Math.Max(atrThresh, medThresh);
            if (displacement < req) return;

            // Optional HTF alignment
            if (_cfg.RequireHtfBias)
            {
                if (type == MSSType.Bullish && !htfBiasIsBullish) return;
                if (type == MSSType.Bearish &&  htfBiasIsBullish) return;
            }

            // Liquidity sweep (either host-provided flag or our check)
            bool hasSweep = hadSweepFlag || DidLiquiditySweep(i, type, _cfg.LiqSweepLookback);
            if (!hasSweep) return;

            // ---- FVG with minimum gap filter ----
            double minGap = Math.Max(0.0, _cfg.MinFvgGapAbs);
            bool hasFvg = (type == MSSType.Bullish)
                ? CCTTB.MSS.Core.Detectors.FVGDetector.HasBullishFVG(_highs, _lows, i, minGap)
                : CCTTB.MSS.Core.Detectors.FVGDetector.HasBearishFVG(_highs, _lows, i, minGap);

            if (_cfg.FvgRequired && !hasFvg) return;

            // Candle structure requirement (wick/body/both)
            if (!BreakTypeCheck(i)) return;

            // ---- FOI: prefer FVG bounds when present (pass minGap), else a simple OB zone ----
            (double low, double high)? foi = hasFvg
                ? ((type == MSSType.Bullish)
                    ? CCTTB.MSS.Core.Detectors.FVGDetector.GapBoundsBullish(_highs, _lows, i, minGap)
                    : CCTTB.MSS.Core.Detectors.FVGDetector.GapBoundsBearish(_highs, _lows, i, minGap))
                : ComputeOBZone(i, type);

            // Map internal MSS detection into the shared project MSSignal model
            var bodyLen = Math.Abs(_closes[i] - _opens[i]);
            double upperWick = Math.Max(0.0, _highs[i] - Math.Max(_opens[i], _closes[i]));
            double lowerWick = Math.Max(0.0, Math.Min(_opens[i], _closes[i]) - _lows[i]);
            double wickLen = Math.Max(upperWick, lowerWick);
            double bodyPct = (bodyLen / Math.Max(_highs[i] - _lows[i], 1e-9)) * 100.0;
            double wickPct = (wickLen / Math.Max(_highs[i] - _lows[i], 1e-9)) * 100.0;
            double combinedPct = ((bodyLen + wickLen) / Math.Max(_highs[i] - _lows[i], 1e-9)) * 100.0;

            var sig = new global::CCTTB.MSSSignal
            {
                Index = i,
                Price = _closes[i],
                Direction = (type == MSSType.Bullish) ? global::CCTTB.BiasDirection.Bullish : global::CCTTB.BiasDirection.Bearish,
                Time = _times[i],
                IsValid = true,
                BodyPercent = bodyPct,
                WickPercent = wickPct,
                CombinedPercent = combinedPct,
                Score = 0,
                FOIRange = foi
            };

            // Try to fill swing anchors similar to other detectors
            try
            {
                int pivot = Math.Max(1, _cfg.SwingLookback);
                if (sig.Direction == global::CCTTB.BiasDirection.Bullish)
                {
                    int loIdx = CCTTB.MSS.Core.Detectors.SwingDetector.LastSwingLowBefore(_lows, i - 1, pivot: Math.Max(1, _cfg.SwingLookback));
                    if (loIdx >= 0)
                    {
                        sig.SwingLow = _lows[loIdx];
                        sig.SwingLowTime = _times[loIdx];
                        sig.ImpulseStart = sig.SwingLow;
                        sig.ImpulseEnd = _highs[i];
                    }
                }
                else
                {
                    int hiIdx = CCTTB.MSS.Core.Detectors.SwingDetector.LastSwingHighBefore(_highs, i - 1, pivot: Math.Max(1, _cfg.SwingLookback));
                    if (hiIdx >= 0)
                    {
                        sig.SwingHigh = _highs[hiIdx];
                        sig.SwingHighTime = _times[hiIdx];
                        sig.ImpulseStart = sig.SwingHigh;
                        sig.ImpulseEnd = _lows[i];
                    }
                }
            }
            catch { }

            // Use the protected raiser from the base type so the derived
            // detector can raise the event without illegal direct invocation.
            RaiseOnSignal(sig);
        }

        private bool BreakTypeCheck(int i)
        {
            double range = Math.Max(_highs[i] - _lows[i], 1e-9);
            double bodyLen   = Math.Abs(_closes[i] - _opens[i]);
            double upperWick = Math.Max(0.0, _highs[i] - Math.Max(_opens[i], _closes[i]));
            double lowerWick = Math.Max(0.0, Math.Min(_opens[i], _closes[i]) - _lows[i]);
            double wickLen   = Math.Max(upperWick, lowerWick);

            double bodyPct   = bodyLen / range * 100.0;
            double wickPct   = wickLen / range * 100.0;
            double combined  = (bodyLen + wickLen) / range * 100.0;

            switch (_cfg.BreakType)
            {
                case MSSBreakType.WickOnly:        return wickPct   >= _cfg.WickThresholdPct;
                case MSSBreakType.BodyPercentOnly: return bodyPct   >= _cfg.BodyPercentThreshold;
                case MSSBreakType.Both:
                default:                            return combined >= _cfg.BothThresholdPct;
            }
        }

        private bool DidLiquiditySweep(int i, MSSType type, int lookback)
        {
            int lb = Math.Max(1, lookback);
            int start = Math.Max(1, i - lb);

            if (type == MSSType.Bullish)
            {
                double recentLow = double.MaxValue;
                for (int k = start; k < i; k++)
                    recentLow = Math.Min(recentLow, _lows[k]);
                return _lows[i - 1] < recentLow;   // swept sell-side
            }
            else
            {
                double recentHigh = double.MinValue;
                for (int k = start; k < i; k++)
                    recentHigh = Math.Max(recentHigh, _highs[k]);
                return _highs[i - 1] > recentHigh; // swept buy-side
            }
        }

        private (double low, double high)? ComputeOBZone(int i, MSSType type)
        {
            // Look back a few bars for an opposite candle body as a simple OB
            int back = Math.Max(1, 10);
            for (int k = i - 1; k >= Math.Max(0, i - back); k--)
            {
                bool opposite = (type == MSSType.Bullish)
                                ? (_closes[k] < _opens[k])
                                : (_closes[k] >= _opens[k]);

                if (!opposite) continue;

                double lo = Math.Min(_opens[k], _closes[k]);
                double hi = Math.Max(_opens[k], _closes[k]);
                return (lo, hi);
            }
            return null;
        }
    }
}

