using System;
using System.Collections.Generic;
using System.Linq;

namespace CCTTB
{
    // ═══════════════════════════════════════════════════════════════════════════════
    // ADVANCED FEATURE: SELF-DIAGNOSIS & ADAPTIVE TUNING - Track Component Performance
    // ═══════════════════════════════════════════════════════════════════════════════

    public class ComponentPerformance
    {
        public int TotalTrades { get; set; }
        public int WinningTrades { get; set; }
        public int LosingTrades { get; set; }
        public double TotalProfit { get; set; }
        public double TotalLoss { get; set; }
        public double AverageConfidence { get; set; }

        public double WinRate => TotalTrades > 0 ? (double)WinningTrades / TotalTrades : 0.0;
        public double ProfitFactor => TotalLoss != 0 ? Math.Abs(TotalProfit / TotalLoss) : 0.0;
        public double AverageWin => WinningTrades > 0 ? TotalProfit / WinningTrades : 0.0;
        public double AverageLoss => LosingTrades > 0 ? Math.Abs(TotalLoss / LosingTrades) : 0.0;
    }

    public class SelfDiagnosis
    {
        private Dictionary<string, ComponentPerformance> _componentStats = new Dictionary<string, ComponentPerformance>();
        private List<double> _recentConfidenceScores = new List<double>();
        private int _maxHistorySize = 50; // Track last 50 trades

        // Track trade outcome by component
        public void RecordTradeOutcome(string component, bool isWin, double profitLoss, double confidence)
        {
            if (!_componentStats.ContainsKey(component))
            {
                _componentStats[component] = new ComponentPerformance();
            }

            var stats = _componentStats[component];
            stats.TotalTrades++;

            if (isWin)
            {
                stats.WinningTrades++;
                stats.TotalProfit += profitLoss;
            }
            else
            {
                stats.LosingTrades++;
                stats.TotalLoss += profitLoss; // Should be negative
            }

            // Update average confidence
            stats.AverageConfidence = ((stats.AverageConfidence * (stats.TotalTrades - 1)) + confidence) / stats.TotalTrades;

            // Track recent confidence scores
            _recentConfidenceScores.Add(confidence);
            if (_recentConfidenceScores.Count > _maxHistorySize)
                _recentConfidenceScores.RemoveAt(0);
        }

        // Get performance report for a component
        public ComponentPerformance GetComponentPerformance(string component)
        {
            return _componentStats.ContainsKey(component) ? _componentStats[component] : new ComponentPerformance();
        }

        // Identify weakest component
        public string GetWeakestComponent()
        {
            if (_componentStats.Count == 0)
                return "None";

            var worst = _componentStats
                .Where(kv => kv.Value.TotalTrades >= 5) // Need minimum sample size
                .OrderBy(kv => kv.Value.WinRate)
                .FirstOrDefault();

            return worst.Key ?? "None";
        }

        // Identify strongest component
        public string GetStrongestComponent()
        {
            if (_componentStats.Count == 0)
                return "None";

            var best = _componentStats
                .Where(kv => kv.Value.TotalTrades >= 5) // Need minimum sample size
                .OrderByDescending(kv => kv.Value.WinRate)
                .FirstOrDefault();

            return best.Key ?? "None";
        }

        // Check if confidence scores are declining
        public bool IsConfidenceDeclining()
        {
            if (_recentConfidenceScores.Count < 20)
                return false;

            // Compare average of first half vs second half
            int midpoint = _recentConfidenceScores.Count / 2;
            double firstHalfAvg = _recentConfidenceScores.Take(midpoint).Average();
            double secondHalfAvg = _recentConfidenceScores.Skip(midpoint).Average();

            // Declining if second half is 10% lower than first half
            return secondHalfAvg < firstHalfAvg * 0.9;
        }

        // Get overall statistics
        public string GetDiagnosticReport()
        {
            if (_componentStats.Count == 0)
                return "No data yet - need at least 5 trades per component";

            var report = new List<string>();
            report.Add("═══════════════════════════════════════════════════════");
            report.Add("SELF-DIAGNOSIS REPORT");
            report.Add("═══════════════════════════════════════════════════════");

            foreach (var kv in _componentStats.OrderByDescending(x => x.Value.TotalTrades))
            {
                string component = kv.Key;
                var stats = kv.Value;

                if (stats.TotalTrades < 5)
                    continue; // Skip components with insufficient data

                string status = stats.WinRate >= 0.6 ? "✅ GOOD" :
                               stats.WinRate >= 0.5 ? "⚠️ AVERAGE" : "❌ POOR";

                report.Add($"{component}: {status}");
                report.Add($"  Trades: {stats.TotalTrades} | WR: {stats.WinRate:P1} | PF: {stats.ProfitFactor:F2}");
                report.Add($"  Avg Win: {stats.AverageWin:F2} | Avg Loss: {stats.AverageLoss:F2}");
                report.Add($"  Avg Confidence: {stats.AverageConfidence:F2}");
                report.Add("");
            }

            // Add recommendations
            report.Add("RECOMMENDATIONS:");
            string weakest = GetWeakestComponent();
            string strongest = GetStrongestComponent();

            if (weakest != "None")
            {
                var weakStats = _componentStats[weakest];
                report.Add($"⚠️  {weakest} is underperforming (WR: {weakStats.WinRate:P1})");
                report.Add($"   → Consider reducing weight or tightening filters");
            }

            if (strongest != "None")
            {
                var strongStats = _componentStats[strongest];
                report.Add($"✅ {strongest} is performing well (WR: {strongStats.WinRate:P1})");
                report.Add($"   → Consider increasing weight or relaxing filters");
            }

            if (IsConfidenceDeclining())
            {
                report.Add($"⚠️  Confidence scores declining");
                report.Add($"   → Review recent market conditions and parameter fit");
            }

            report.Add("═══════════════════════════════════════════════════════");

            return string.Join("\n", report);
        }

        // Suggest parameter adjustments
        public Dictionary<string, string> GetParameterSuggestions()
        {
            var suggestions = new Dictionary<string, string>();

            // Check overall win rate
            int totalTrades = _componentStats.Sum(x => x.Value.TotalTrades);
            int totalWins = _componentStats.Sum(x => x.Value.WinningTrades);
            double overallWR = totalTrades > 0 ? (double)totalWins / totalTrades : 0.0;

            if (overallWR < 0.45 && totalTrades >= 20)
            {
                suggestions["OverallWR"] = "Win rate below 45% - Consider increasing AdaptiveConfidenceThreshold from 0.6 to 0.7";
            }
            else if (overallWR > 0.70 && totalTrades >= 20)
            {
                suggestions["OverallWR"] = "Win rate above 70% - Consider decreasing AdaptiveConfidenceThreshold from 0.6 to 0.5 for more trades";
            }

            // Check OTE performance specifically
            if (_componentStats.ContainsKey("OTE"))
            {
                var oteStats = _componentStats["OTE"];
                if (oteStats.TotalTrades >= 10 && oteStats.WinRate < 0.5)
                {
                    suggestions["OTE"] = "OTE underperforming - Consider tightening TapTolerancePips or increasing FibLevelMin";
                }
            }

            // Check MSS performance
            if (_componentStats.ContainsKey("MSS"))
            {
                var mssStats = _componentStats["MSS"];
                if (mssStats.TotalTrades >= 10 && mssStats.WinRate < 0.5)
                {
                    suggestions["MSS"] = "MSS underperforming - Consider increasing MinStructureBreakPips threshold";
                }
            }

            return suggestions;
        }
    }
}
