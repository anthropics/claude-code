using cAlgo.API;
using cAlgo.API.Internals;
using System;
using System.Collections.Generic;
using System.Linq;

namespace CCTTB
{
    /// <summary>
    /// INTELLIGENT BIAS ANALYZER - Automatically detects bias on ANY timeframe
    /// Works from M1 to Monthly - adapts HTF analysis automatically
    /// </summary>
    public class IntelligentBiasAnalyzer
    {
        private readonly Robot _bot;
        private readonly Symbol _symbol;
        private readonly Dictionary<TimeFrame, BiasAnalysis> _biasCache;
        private readonly Dictionary<TimeFrame, TimeFrame[]> _htfMapping;

        public class BiasAnalysis
        {
            public BiasDirection Bias { get; set; }
            public double Strength { get; set; } // 0-100%
            public string Reason { get; set; }
            public DateTime LastUpdate { get; set; }
            public List<string> Confluences { get; set; } = new List<string>();
            public SweepContext LastSweep { get; set; }
            public string Phase { get; set; } // Accumulation/Manipulation/Distribution
        }

        public class SweepContext
        {
            public string Type { get; set; } // "Liquidity", "StopHunt", "Manipulation"
            public string Direction { get; set; } // "Up" or "Down"
            public double Level { get; set; }
            public DateTime Time { get; set; }
            public string ExpectedReaction { get; set; } // What should happen next
        }

        public IntelligentBiasAnalyzer(Robot bot, Symbol symbol)
        {
            _bot = bot;
            _symbol = symbol;
            _biasCache = new Dictionary<TimeFrame, BiasAnalysis>();
            _htfMapping = BuildIntelligentHTFMapping();
        }

        /// <summary>
        /// INTELLIGENT HTF MAPPING - Automatically determines best HTF for any chart TF
        /// </summary>
        private Dictionary<TimeFrame, TimeFrame[]> BuildIntelligentHTFMapping()
        {
            return new Dictionary<TimeFrame, TimeFrame[]>
            {
                // Scalping timeframes (M1-M5)
                { TimeFrame.Minute, new[] { TimeFrame.Minute5, TimeFrame.Minute15, TimeFrame.Hour } },
                { TimeFrame.Minute2, new[] { TimeFrame.Minute15, TimeFrame.Hour, TimeFrame.Hour4 } },
                { TimeFrame.Minute3, new[] { TimeFrame.Minute15, TimeFrame.Hour, TimeFrame.Hour4 } },
                { TimeFrame.Minute5, new[] { TimeFrame.Hour, TimeFrame.Hour4, TimeFrame.Daily } },

                // Intraday timeframes (M10-H1)
                { TimeFrame.Minute10, new[] { TimeFrame.Hour, TimeFrame.Hour4, TimeFrame.Daily } },
                { TimeFrame.Minute15, new[] { TimeFrame.Hour4, TimeFrame.Daily, TimeFrame.Weekly } },
                { TimeFrame.Minute30, new[] { TimeFrame.Hour4, TimeFrame.Daily, TimeFrame.Weekly } },
                { TimeFrame.Minute45, new[] { TimeFrame.Hour4, TimeFrame.Daily, TimeFrame.Weekly } },
                { TimeFrame.Hour, new[] { TimeFrame.Hour4, TimeFrame.Daily, TimeFrame.Weekly } },

                // Swing timeframes (H4-D1)
                { TimeFrame.Hour4, new[] { TimeFrame.Daily, TimeFrame.Weekly, TimeFrame.Monthly } },
                { TimeFrame.Daily, new[] { TimeFrame.Weekly, TimeFrame.Monthly, TimeFrame.Monthly } },

                // Position timeframes (W1-MN)
                { TimeFrame.Weekly, new[] { TimeFrame.Monthly, TimeFrame.Monthly, TimeFrame.Monthly } },
                { TimeFrame.Monthly, new[] { TimeFrame.Monthly, TimeFrame.Monthly, TimeFrame.Monthly } }
            };
        }

        /// <summary>
        /// GET INTELLIGENT BIAS - Main method that analyzes bias for current chart
        /// </summary>
        public BiasAnalysis GetIntelligentBias(TimeFrame chartTF)
        {
            // Check cache first
            if (_biasCache.ContainsKey(chartTF))
            {
                var cached = _biasCache[chartTF];
                if ((DateTime.Now - cached.LastUpdate).TotalSeconds < 5)
                    return cached;
            }

            // Get appropriate HTF for this chart
            var htfArray = GetHTFForChart(chartTF);

            // Perform multi-layer analysis
            var analysis = new BiasAnalysis
            {
                LastUpdate = DateTime.Now,
                Bias = BiasDirection.Neutral,
                Strength = 0,
                Reason = "Analyzing..."
            };

            // Layer 1: Market Structure Analysis
            var structureBias = AnalyzeMarketStructure(chartTF, htfArray[0]);
            if (structureBias != BiasDirection.Neutral)
            {
                analysis.Bias = structureBias;
                analysis.Confluences.Add($"Structure: {structureBias}");
                analysis.Strength += 30;
            }

            // Layer 2: HTF Trend Analysis
            var htfTrend = AnalyzeHTFTrend(htfArray[1], htfArray[2]);
            if (htfTrend == structureBias)
            {
                analysis.Confluences.Add($"HTF Trend: {htfTrend}");
                analysis.Strength += 40;
            }
            else if (htfTrend != BiasDirection.Neutral)
            {
                analysis.Confluences.Add($"HTF Conflict: {htfTrend}");
                analysis.Strength -= 20;
            }

            // Layer 3: Power of Three Phase Detection
            var phase = DetectPowerOfThreePhase(chartTF);
            analysis.Phase = phase;
            analysis.Confluences.Add($"Phase: {phase}");

            // Layer 4: Sweep Detection & Context
            var sweep = DetectIntelligentSweep(chartTF);
            if (sweep != null)
            {
                analysis.LastSweep = sweep;
                analysis.Confluences.Add($"Sweep: {sweep.Type} {sweep.Direction}");

                // Adjust bias based on sweep context
                if (sweep.Type == "Manipulation" && phase == "Manipulation")
                {
                    // Expect reversal after manipulation sweep
                    if (sweep.Direction == "Up" && analysis.Bias == BiasDirection.Bearish)
                        analysis.Strength += 20;
                    else if (sweep.Direction == "Down" && analysis.Bias == BiasDirection.Bullish)
                        analysis.Strength += 20;
                }
            }

            // Layer 5: Volume & Momentum Analysis
            var momentum = AnalyzeMomentum(chartTF);
            if (momentum == analysis.Bias)
            {
                analysis.Confluences.Add($"Momentum: Strong {momentum}");
                analysis.Strength += 10;
            }

            // Final bias determination
            if (analysis.Strength >= 70)
            {
                analysis.Reason = $"Strong {analysis.Bias} bias ({analysis.Strength}%)";
            }
            else if (analysis.Strength >= 40)
            {
                analysis.Reason = $"Moderate {analysis.Bias} bias ({analysis.Strength}%)";
            }
            else
            {
                analysis.Bias = BiasDirection.Neutral;
                analysis.Reason = "No clear bias - wait for confirmation";
            }

            // Update cache
            _biasCache[chartTF] = analysis;
            return analysis;
        }

        /// <summary>
        /// ANALYZE MARKET STRUCTURE - Detects HH/HL or LL/LH patterns
        /// </summary>
        private BiasDirection AnalyzeMarketStructure(TimeFrame tf, TimeFrame htf)
        {
            var bars = _bot.MarketData.GetBars(tf, _symbol.Name);
            if (bars.Count < 50) return BiasDirection.Neutral;

            // Find swing points
            var swings = FindSwingPoints(bars, 10);
            if (swings.Count < 4) return BiasDirection.Neutral;

            // Check last 4 swings for structure
            var lastHighs = swings.Where(s => s.IsHigh).TakeLast(2).ToList();
            var lastLows = swings.Where(s => !s.IsHigh).TakeLast(2).ToList();

            if (lastHighs.Count == 2 && lastLows.Count == 2)
            {
                bool hh = lastHighs[1].Price > lastHighs[0].Price;
                bool hl = lastLows[1].Price > lastLows[0].Price;
                bool lh = lastHighs[1].Price < lastHighs[0].Price;
                bool ll = lastLows[1].Price < lastLows[0].Price;

                if (hh && hl) return BiasDirection.Bullish;
                if (lh && ll) return BiasDirection.Bearish;
            }

            return BiasDirection.Neutral;
        }

        /// <summary>
        /// ANALYZE HTF TREND - Checks higher timeframe direction using proper swing analysis
        /// </summary>
        private BiasDirection AnalyzeHTFTrend(TimeFrame htf1, TimeFrame htf2)
        {
            var htfBars = _bot.MarketData.GetBars(htf1, _symbol.Name);
            if (htfBars.Count < 20) return BiasDirection.Neutral;

            // Look at last 10-20 candles to determine trend, not just 2 candles
            int lookback = Math.Min(20, htfBars.Count - 2);
            int startIdx = htfBars.Count - lookback - 1;
            int endIdx = htfBars.Count - 2; // Last completed candle

            // Find swing high and swing low in this range
            double swingHigh = htfBars.HighPrices.Skip(startIdx).Take(lookback).Max();
            double swingLow = htfBars.LowPrices.Skip(startIdx).Take(lookback).Min();

            // Get current price relative to range
            double currentClose = htfBars.ClosePrices[endIdx];
            double range = swingHigh - swingLow;
            if (range == 0) return BiasDirection.Neutral;

            double positionInRange = (currentClose - swingLow) / range;

            // Check if we're making higher highs or lower lows
            int midpoint = startIdx + (lookback / 2);
            double firstHalfHigh = htfBars.HighPrices.Skip(startIdx).Take(lookback / 2).Max();
            double secondHalfHigh = htfBars.HighPrices.Skip(midpoint).Take(lookback / 2).Max();
            double firstHalfLow = htfBars.LowPrices.Skip(startIdx).Take(lookback / 2).Min();
            double secondHalfLow = htfBars.LowPrices.Skip(midpoint).Take(lookback / 2).Min();

            bool makingHigherHighs = secondHalfHigh > firstHalfHigh;
            bool makingHigherLows = secondHalfLow > firstHalfLow;
            bool makingLowerHighs = secondHalfHigh < firstHalfHigh;
            bool makingLowerLows = secondHalfLow < firstHalfLow;

            // Bullish trend: Higher highs + higher lows + price in upper range
            if (makingHigherHighs && makingHigherLows && positionInRange > 0.5)
                return BiasDirection.Bullish;

            // Bearish trend: Lower highs + lower lows + price in lower range
            if (makingLowerHighs && makingLowerLows && positionInRange < 0.5)
                return BiasDirection.Bearish;

            // Fallback: Check if current close is trending
            double oldClose = htfBars.ClosePrices[startIdx];
            double priceDiff = currentClose - oldClose;

            if (priceDiff > range * 0.3) // Moved up significantly
                return BiasDirection.Bullish;
            else if (priceDiff < -range * 0.3) // Moved down significantly
                return BiasDirection.Bearish;

            return BiasDirection.Neutral;
        }

        /// <summary>
        /// DETECT POWER OF THREE PHASE - Accumulation/Manipulation/Distribution
        /// </summary>
        private string DetectPowerOfThreePhase(TimeFrame tf)
        {
            var utcNow = _bot.Server.Time.ToUniversalTime();
            var hour = utcNow.Hour;

            // Adjust phase detection based on timeframe
            if (tf <= TimeFrame.Minute15)
            {
                // Intraday phases
                if (hour >= 0 && hour < 9) return "Accumulation";
                if (hour >= 9 && hour < 13) return "Manipulation";
                if (hour >= 13 && hour < 24) return "Distribution";
            }
            else if (tf <= TimeFrame.Hour4)
            {
                // Daily phases
                var dayOfWeek = utcNow.DayOfWeek;
                if (dayOfWeek == DayOfWeek.Monday || dayOfWeek == DayOfWeek.Tuesday)
                    return "Accumulation";
                if (dayOfWeek == DayOfWeek.Wednesday || dayOfWeek == DayOfWeek.Thursday)
                    return "Manipulation";
                if (dayOfWeek == DayOfWeek.Friday)
                    return "Distribution";
            }
            else
            {
                // Weekly/Monthly phases
                var dayOfMonth = utcNow.Day;
                if (dayOfMonth <= 10) return "Accumulation";
                if (dayOfMonth <= 20) return "Manipulation";
                return "Distribution";
            }

            return "Transition";
        }

        /// <summary>
        /// DETECT INTELLIGENT SWEEP - Identifies sweep type and expected reaction
        /// </summary>
        private SweepContext DetectIntelligentSweep(TimeFrame tf)
        {
            var bars = _bot.MarketData.GetBars(tf, _symbol.Name);
            if (bars.Count < 20) return null;

            int idx = bars.Count - 1;
            double high = bars.HighPrices[idx];
            double low = bars.LowPrices[idx];
            double close = bars.ClosePrices[idx];

            // Find recent highs/lows
            double recentHigh = bars.HighPrices.Skip(Math.Max(0, idx - 20)).Take(19).Max();
            double recentLow = bars.LowPrices.Skip(Math.Max(0, idx - 20)).Take(19).Min();

            var sweep = new SweepContext { Time = bars.OpenTimes[idx] };

            // Check for sweep up
            if (high > recentHigh && close < recentHigh)
            {
                sweep.Direction = "Up";
                sweep.Level = recentHigh;
                sweep.Type = DetermineSweepType(tf, "Up");
                sweep.ExpectedReaction = sweep.Type == "Manipulation" ?
                    "Expect bearish reversal" : "Expect continuation up after pullback";
                return sweep;
            }

            // Check for sweep down
            if (low < recentLow && close > recentLow)
            {
                sweep.Direction = "Down";
                sweep.Level = recentLow;
                sweep.Type = DetermineSweepType(tf, "Down");
                sweep.ExpectedReaction = sweep.Type == "Manipulation" ?
                    "Expect bullish reversal" : "Expect continuation down after pullback";
                return sweep;
            }

            return null;
        }

        /// <summary>
        /// DETERMINE SWEEP TYPE - Liquidity, Stop Hunt, or Manipulation
        /// </summary>
        private string DetermineSweepType(TimeFrame tf, string direction)
        {
            var phase = DetectPowerOfThreePhase(tf);
            var hour = _bot.Server.Time.ToUniversalTime().Hour;

            // Manipulation sweeps occur during manipulation phase
            if (phase == "Manipulation")
                return "Manipulation";

            // Stop hunts typically occur at session opens
            if (hour == 0 || hour == 8 || hour == 13)
                return "StopHunt";

            // Default to liquidity sweep
            return "Liquidity";
        }

        /// <summary>
        /// ANALYZE MOMENTUM - Checks current momentum direction
        /// </summary>
        private BiasDirection AnalyzeMomentum(TimeFrame tf)
        {
            var bars = _bot.MarketData.GetBars(tf, _symbol.Name);
            if (bars.Count < 14) return BiasDirection.Neutral;

            // Simple momentum: Compare current close to 10 bars ago
            int idx = bars.Count - 1;
            double currentClose = bars.ClosePrices[idx];
            double pastClose = bars.ClosePrices[Math.Max(0, idx - 10)];

            double change = (currentClose - pastClose) / pastClose * 100;

            if (change > 0.1) return BiasDirection.Bullish;
            if (change < -0.1) return BiasDirection.Bearish;
            return BiasDirection.Neutral;
        }

        /// <summary>
        /// FIND SWING POINTS - Identifies highs and lows
        /// </summary>
        private List<SwingPoint> FindSwingPoints(Bars bars, int lookback)
        {
            var swings = new List<SwingPoint>();

            for (int i = lookback; i < bars.Count - lookback; i++)
            {
                double high = bars.HighPrices[i];
                double low = bars.LowPrices[i];

                // Check for swing high
                bool isSwingHigh = true;
                for (int j = i - lookback; j <= i + lookback; j++)
                {
                    if (j != i && bars.HighPrices[j] >= high)
                    {
                        isSwingHigh = false;
                        break;
                    }
                }

                if (isSwingHigh)
                    swings.Add(new SwingPoint { Index = i, Price = high, IsHigh = true, Time = bars.OpenTimes[i] });

                // Check for swing low
                bool isSwingLow = true;
                for (int j = i - lookback; j <= i + lookback; j++)
                {
                    if (j != i && bars.LowPrices[j] <= low)
                    {
                        isSwingLow = false;
                        break;
                    }
                }

                if (isSwingLow)
                    swings.Add(new SwingPoint { Index = i, Price = low, IsHigh = false, Time = bars.OpenTimes[i] });
            }

            return swings;
        }

        /// <summary>
        /// GET HTF FOR CHART - Returns appropriate HTF array for any chart TF
        /// </summary>
        private TimeFrame[] GetHTFForChart(TimeFrame chartTF)
        {
            if (_htfMapping.ContainsKey(chartTF))
                return _htfMapping[chartTF];

            // Default fallback
            return new[] { TimeFrame.Hour4, TimeFrame.Daily, TimeFrame.Weekly };
        }

        /// <summary>
        /// GET BIAS SUMMARY - Returns formatted string for display
        /// </summary>
        public string GetBiasSummary(TimeFrame chartTF)
        {
            var analysis = GetIntelligentBias(chartTF);

            var summary = $"═══ INTELLIGENT BIAS ANALYSIS [{chartTF}] ═══\n";
            summary += $"Direction: {analysis.Bias} ({analysis.Strength}%)\n";
            summary += $"Phase: {analysis.Phase}\n";
            summary += $"Reason: {analysis.Reason}\n";

            if (analysis.LastSweep != null)
            {
                summary += $"Last Sweep: {analysis.LastSweep.Type} {analysis.LastSweep.Direction}\n";
                summary += $"Expected: {analysis.LastSweep.ExpectedReaction}\n";
            }

            if (analysis.Confluences.Any())
            {
                summary += "Confluences:\n";
                foreach (var conf in analysis.Confluences)
                    summary += $"  • {conf}\n";
            }

            return summary;
        }

        private class SwingPoint
        {
            public int Index { get; set; }
            public double Price { get; set; }
            public bool IsHigh { get; set; }
            public DateTime Time { get; set; }
        }
    }
}