using cAlgo.API;
using System;
using System.Collections.Generic;
using System.Linq;

namespace CCTTB
{
    /// <summary>
    /// BIAS DASHBOARD - Visual display of bias across all timeframes
    /// Shows real-time bias status for M1, M5, M15, H1, H4, D1, W1
    /// </summary>
    public class BiasDashboard
    {
        private readonly Robot _bot;
        private readonly Chart _chart;
        private readonly IntelligentBiasAnalyzer _analyzer;
        private readonly Dictionary<TimeFrame, Color> _biasColors;
        private DateTime _lastUpdate;

        // Dashboard configuration
        private const int DASHBOARD_X = 10;
        private const int DASHBOARD_Y = 50;
        private const int ROW_HEIGHT = 25;
        private const int COLUMN_WIDTH = 120;

        public BiasDashboard(Robot bot, IntelligentBiasAnalyzer analyzer)
        {
            _bot = bot;
            _chart = bot.Chart;
            _analyzer = analyzer;
            _lastUpdate = DateTime.MinValue;

            _biasColors = new Dictionary<TimeFrame, Color>
            {
                { TimeFrame.Minute, Color.LightGray },
                { TimeFrame.Minute5, Color.LightGray },
                { TimeFrame.Minute15, Color.LightGray },
                { TimeFrame.Hour, Color.LightGray },
                { TimeFrame.Hour4, Color.LightGray },
                { TimeFrame.Daily, Color.LightGray },
                { TimeFrame.Weekly, Color.LightGray }
            };
        }

        /// <summary>
        /// UPDATE DASHBOARD - Refreshes bias display for all timeframes
        /// </summary>
        public void UpdateDashboard()
        {
            // Throttle updates to every 2 seconds
            if ((DateTime.Now - _lastUpdate).TotalSeconds < 2)
                return;

            _lastUpdate = DateTime.Now;

            // Clear old dashboard
            ClearDashboard();

            try
            {
                // Build consolidated dashboard text (RIGHT SIDE to avoid overlap with Performance HUD)
                string dashboardText = "╔═══ INTELLIGENT BIAS DASHBOARD ═══╗\n";
                dashboardText += $"Updated: {DateTime.Now:HH:mm:ss}\n";
                dashboardText += "════════════════════════════════════\n\n";

                // Analyze and display each timeframe
                var timeframes = new[]
                {
                    TimeFrame.Minute,
                    TimeFrame.Minute5,
                    TimeFrame.Minute15,
                    TimeFrame.Hour,
                    TimeFrame.Hour4,
                    TimeFrame.Daily,
                    TimeFrame.Weekly
                };

                foreach (var tf in timeframes)
                {
                    try
                    {
                        var analysis = _analyzer.GetIntelligentBias(tf);
                        string tfLabel = GetTimeframeLabel(tf);
                        Color biasColor = GetBiasColor(analysis.Bias, analysis.Strength);
                        string biasText = GetBiasText(analysis.Bias, analysis.Strength);
                        string strengthBar = GetStrengthBar(analysis.Strength);
                        string phaseText = analysis.Phase?.Substring(0, Math.Min(3, analysis.Phase.Length)) ?? "";

                        // Format: "M5: BULL ██████░░░░ 60% [ACC]"
                        dashboardText += $"{tfLabel}: {biasText.PadRight(8)} {strengthBar} {analysis.Strength}%";
                        if (!string.IsNullOrEmpty(phaseText))
                        {
                            dashboardText += $" [{phaseText}]";
                        }
                        dashboardText += "\n";

                        // Store color for visual reference
                        _biasColors[tf] = biasColor;
                    }
                    catch
                    {
                        // Skip timeframes that aren't available
                        continue;
                    }
                }

                // Add current chart detailed analysis
                var currentTF = _chart.TimeFrame;
                var currentAnalysis = _analyzer.GetIntelligentBias(currentTF);
                dashboardText += $"\n═ CURRENT CHART ({currentTF}) ═\n";
                dashboardText += $"Bias: {currentAnalysis.Bias} ({currentAnalysis.Strength}%)\n";
                dashboardText += $"Phase: {currentAnalysis.Phase}\n";
                dashboardText += $"Status: {currentAnalysis.Reason}\n";

                if (currentAnalysis.Confluences.Any())
                {
                    dashboardText += "\nConfluences:\n";
                    foreach (var conf in currentAnalysis.Confluences.Take(3))
                    {
                        dashboardText += $" ✓ {conf}\n";
                    }
                }

                // Add sweep indicator if available
                if (currentAnalysis.LastSweep != null)
                {
                    var sweep = currentAnalysis.LastSweep;
                    dashboardText += $"\n⚡ SWEEP: {sweep.Type} {sweep.Direction}\n";
                    dashboardText += $"Level: {sweep.Level:F5}\n";
                    dashboardText += $"Action: {sweep.ExpectedReaction}\n";
                }

                // Draw single consolidated text block on RIGHT side
                _chart.DrawStaticText("IntelligentBiasDashboard",
                    dashboardText,
                    VerticalAlignment.Top,
                    HorizontalAlignment.Right,
                    Color.White);
            }
            catch (Exception ex)
            {
                _bot.Print($"[BIAS DASHBOARD] Error: {ex.Message}");
            }
        }

        /// <summary>
        /// DRAW HEADER - Creates dashboard title (RIGHT SIDE to avoid overlap)
        /// </summary>
        private void DrawHeader()
        {
            // Move entire dashboard to RIGHT side to avoid overlapping with Performance HUD (left side)
            string headerText = "╔═══ INTELLIGENT BIAS DASHBOARD ═══╗\n";
            headerText += $"Updated: {DateTime.Now:HH:mm:ss}\n";

            _chart.DrawStaticText("DashHeader",
                headerText,
                VerticalAlignment.Top,
                HorizontalAlignment.Right,
                Color.Gold);
        }

        /// <summary>
        /// DRAW TIMEFRAME BIAS - Shows bias for specific timeframe
        /// </summary>
        private void DrawTimeframeBias(TimeFrame tf, IntelligentBiasAnalyzer.BiasAnalysis analysis, int row)
        {
            string tfLabel = GetTimeframeLabel(tf);
            Color biasColor = GetBiasColor(analysis.Bias, analysis.Strength);
            string biasText = GetBiasText(analysis.Bias, analysis.Strength);
            string phaseText = analysis.Phase?.Substring(0, Math.Min(3, analysis.Phase.Length)) ?? "";

            // Draw timeframe label
            string labelId = $"TF_{tf}";
            _chart.DrawStaticText(labelId,
                tfLabel,
                VerticalAlignment.Top,
                HorizontalAlignment.Left,
                Color.White);

            // Draw bias direction with color
            string biasId = $"Bias_{tf}";
            _chart.DrawStaticText(biasId,
                $"  {biasText}",
                VerticalAlignment.Top,
                HorizontalAlignment.Left,
                biasColor);

            // Draw strength meter
            string strengthBar = GetStrengthBar(analysis.Strength);
            string strengthId = $"Strength_{tf}";
            _chart.DrawStaticText(strengthId,
                $"    {strengthBar}",
                VerticalAlignment.Top,
                HorizontalAlignment.Left,
                Color.Gray);

            // Draw phase indicator
            if (!string.IsNullOrEmpty(phaseText))
            {
                string phaseId = $"Phase_{tf}";
                _chart.DrawStaticText(phaseId,
                    $"      [{phaseText}]",
                    VerticalAlignment.Top,
                    HorizontalAlignment.Left,
                    Color.Yellow);
            }

            // Store color for visual reference
            _biasColors[tf] = biasColor;
        }

        /// <summary>
        /// DRAW DETAILED ANALYSIS - Shows full analysis for current chart
        /// </summary>
        private void DrawDetailedAnalysis()
        {
            var currentTF = _chart.TimeFrame;
            var analysis = _analyzer.GetIntelligentBias(currentTF);

            // Create detailed text
            string details = $"\n\n════ CURRENT CHART ({currentTF}) ════\n";
            details += $"Bias: {analysis.Bias} ({analysis.Strength}%)\n";
            details += $"Phase: {analysis.Phase}\n";
            details += $"Status: {analysis.Reason}\n";

            if (analysis.Confluences.Any())
            {
                details += "\nConfluences:\n";
                foreach (var conf in analysis.Confluences.Take(3))
                {
                    details += $" ✓ {conf}\n";
                }
            }

            _chart.DrawStaticText("DetailedAnalysis",
                details,
                VerticalAlignment.Bottom,
                HorizontalAlignment.Left,
                Color.Cyan);
        }

        /// <summary>
        /// DRAW SWEEP INDICATOR - Shows last sweep and expected reaction
        /// </summary>
        private void DrawSweepIndicator()
        {
            var currentTF = _chart.TimeFrame;
            var analysis = _analyzer.GetIntelligentBias(currentTF);

            if (analysis.LastSweep != null)
            {
                var sweep = analysis.LastSweep;
                Color sweepColor = sweep.Type == "Manipulation" ? Color.Red :
                                  sweep.Type == "StopHunt" ? Color.Orange :
                                  Color.Yellow;

                string sweepText = $"\n⚡ SWEEP DETECTED ⚡\n";
                sweepText += $"Type: {sweep.Type} {sweep.Direction}\n";
                sweepText += $"Level: {sweep.Level:F5}\n";
                sweepText += $"Action: {sweep.ExpectedReaction}";

                _chart.DrawStaticText("SweepIndicator",
                    sweepText,
                    VerticalAlignment.Bottom,
                    HorizontalAlignment.Right,
                    sweepColor);

                // Draw arrow on chart at sweep level
                string arrowId = $"SweepArrow_{sweep.Time.Ticks}";
                if (sweep.Direction == "Up")
                {
                    _chart.DrawIcon(arrowId,
                        ChartIconType.UpArrow,
                        sweep.Time,
                        sweep.Level,
                        sweepColor);
                }
                else
                {
                    _chart.DrawIcon(arrowId,
                        ChartIconType.DownArrow,
                        sweep.Time,
                        sweep.Level,
                        sweepColor);
                }
            }
        }

        /// <summary>
        /// GET BIAS COLOR - Returns color based on bias and strength
        /// </summary>
        private Color GetBiasColor(BiasDirection bias, double strength)
        {
            if (bias == BiasDirection.Bullish)
            {
                if (strength >= 70) return Color.LimeGreen;
                if (strength >= 40) return Color.Green;
                return Color.DarkGreen;
            }
            else if (bias == BiasDirection.Bearish)
            {
                if (strength >= 70) return Color.Red;
                if (strength >= 40) return Color.OrangeRed;
                return Color.DarkRed;
            }
            else
            {
                return Color.Gray;
            }
        }

        /// <summary>
        /// GET BIAS TEXT - Returns formatted bias text
        /// </summary>
        private string GetBiasText(BiasDirection bias, double strength)
        {
            string arrow = bias == BiasDirection.Bullish ? "↑" :
                          bias == BiasDirection.Bearish ? "↓" : "→";

            string power = strength >= 70 ? "STRONG" :
                          strength >= 40 ? "MOD" : "WEAK";

            if (bias == BiasDirection.Neutral)
                return "→ NEUTRAL";

            return $"{arrow} {bias.ToString().ToUpper()} ({power})";
        }

        /// <summary>
        /// GET STRENGTH BAR - Creates visual strength meter
        /// </summary>
        private string GetStrengthBar(double strength)
        {
            int bars = (int)(strength / 20); // 0-5 bars
            string meter = "[";

            for (int i = 0; i < 5; i++)
            {
                if (i < bars)
                    meter += "■";
                else
                    meter += "□";
            }

            meter += $"] {strength:F0}%";
            return meter;
        }

        /// <summary>
        /// GET TIMEFRAME LABEL - Returns friendly TF name
        /// </summary>
        private string GetTimeframeLabel(TimeFrame tf)
        {
            var labels = new Dictionary<TimeFrame, string>
            {
                { TimeFrame.Minute, "M1" },
                { TimeFrame.Minute5, "M5" },
                { TimeFrame.Minute15, "M15" },
                { TimeFrame.Hour, "H1" },
                { TimeFrame.Hour4, "H4" },
                { TimeFrame.Daily, "D1" },
                { TimeFrame.Weekly, "W1" },
                { TimeFrame.Monthly, "MN" }
            };

            return labels.ContainsKey(tf) ? labels[tf] : tf.ToString();
        }

        /// <summary>
        /// CLEAR DASHBOARD - Removes old text objects
        /// </summary>
        private void ClearDashboard()
        {
            var objectsToRemove = new List<string>();

            foreach (var obj in _chart.Objects)
            {
                if (obj.Name.StartsWith("TF_") ||
                    obj.Name.StartsWith("Bias_") ||
                    obj.Name.StartsWith("Strength_") ||
                    obj.Name.StartsWith("Phase_") ||
                    obj.Name.StartsWith("Dash") ||
                    obj.Name.StartsWith("Sweep") ||
                    obj.Name.StartsWith("Intelligent") ||  // New consolidated dashboard
                    obj.Name.StartsWith("Detailed"))       // Old detailed analysis
                {
                    objectsToRemove.Add(obj.Name);
                }
            }

            foreach (var name in objectsToRemove)
            {
                _chart.RemoveObject(name);
            }
        }

        /// <summary>
        /// GET MULTI-TF CONSENSUS - Returns overall market consensus
        /// </summary>
        public string GetMultiTimeframeConsensus()
        {
            var timeframes = new[]
            {
                TimeFrame.Minute5,
                TimeFrame.Minute15,
                TimeFrame.Hour,
                TimeFrame.Hour4,
                TimeFrame.Daily
            };

            int bullishCount = 0;
            int bearishCount = 0;
            double totalStrength = 0;

            foreach (var tf in timeframes)
            {
                try
                {
                    var analysis = _analyzer.GetIntelligentBias(tf);
                    if (analysis.Bias == BiasDirection.Bullish)
                    {
                        bullishCount++;
                        totalStrength += analysis.Strength;
                    }
                    else if (analysis.Bias == BiasDirection.Bearish)
                    {
                        bearishCount++;
                        totalStrength += analysis.Strength;
                    }
                }
                catch { }
            }

            if (bullishCount > bearishCount && bullishCount >= 3)
            {
                double avgStrength = totalStrength / bullishCount;
                return $"BULLISH CONSENSUS ({bullishCount}/5 TFs agree, {avgStrength:F0}% avg)";
            }
            else if (bearishCount > bullishCount && bearishCount >= 3)
            {
                double avgStrength = totalStrength / bearishCount;
                return $"BEARISH CONSENSUS ({bearishCount}/5 TFs agree, {avgStrength:F0}% avg)";
            }
            else
            {
                return "NO CONSENSUS - Mixed signals across timeframes";
            }
        }
    }
}