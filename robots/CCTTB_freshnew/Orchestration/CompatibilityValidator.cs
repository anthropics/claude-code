using cAlgo.API;
using System;
using System.Collections.Generic;
using System.Linq;

namespace CCTTB
{
    public class CompatibilityCheck
    {
        public bool IsValid { get; set; }
        public string Component { get; set; }
        public string Message { get; set; }
        public DateTime CheckedAt { get; set; }
    }

    public class CompatibilityValidator
    {
        private readonly Robot _bot;
        private List<CompatibilityCheck> _checks = new List<CompatibilityCheck>();

        public CompatibilityValidator(Robot bot)
        {
            _bot = bot;
        }

        public bool ValidateAll(
            OrchestratorGate gate,
            HtfMapper mapper,
            HtfDataProvider htfData,
            LiquidityReferenceManager refManager,
            TimeFrame chartTf)
        {
            _checks.Clear();

            // 1. Orchestrator gate endpoints reachable
            _checks.Add(new CompatibilityCheck
            {
                Component = "OrchestratorGate",
                IsValid = gate != null && gate.IsInitialized(),
                Message = gate != null && gate.IsInitialized()
                    ? "Gate initialized successfully"
                    : "Gate not initialized or null",
                CheckedAt = DateTime.UtcNow
            });

            // 2. TF map compatibility
            try
            {
                var (primary, secondary) = mapper.GetHtfPair(chartTf);
                _checks.Add(new CompatibilityCheck
                {
                    Component = "HtfMapper",
                    IsValid = true,
                    Message = $"Chart {chartTf} mapped to HTF {primary}/{secondary}",
                    CheckedAt = DateTime.UtcNow
                });
            }
            catch (Exception ex)
            {
                _checks.Add(new CompatibilityCheck
                {
                    Component = "HtfMapper",
                    IsValid = false,
                    Message = $"TF mapping failed: {ex.Message}",
                    CheckedAt = DateTime.UtcNow
                });
                return false; // Critical failure
            }

            // 3. HTF data availability
            var (pri, sec) = mapper.GetHtfPair(chartTf);
            var priCandle = htfData.GetLastCompletedCandle(pri);
            var secCandle = htfData.GetLastCompletedCandle(sec);
            bool htfDataValid = priCandle != null && secCandle != null;
            _checks.Add(new CompatibilityCheck
            {
                Component = "HtfDataProvider",
                IsValid = htfDataValid,
                Message = htfDataValid
                    ? $"HTF data available: {pri}={priCandle?.OpenTime:yyyy-MM-dd HH:mm}, {sec}={secCandle?.OpenTime:yyyy-MM-dd HH:mm}"
                    : "HTF data missing or insufficient bars",
                CheckedAt = DateTime.UtcNow
            });

            // 4. Reference levels valid
            var refs = refManager.ComputeAllReferences(pri, sec);
            bool allRefsValid = refs.All(r => r.Level > 0 && !double.IsNaN(r.Level) && !double.IsInfinity(r.Level));
            int refCount = refs.Count;
            _checks.Add(new CompatibilityCheck
            {
                Component = "LiquidityReferenceManager",
                IsValid = allRefsValid && refCount >= 4,
                Message = $"{refCount} references computed (valid={allRefsValid}): {string.Join(", ", refs.Select(r => r.Label))}",
                CheckedAt = DateTime.UtcNow
            });

            // 5. Chart timeframe supported
            bool tfSupported = mapper.IsSupported(chartTf);
            _checks.Add(new CompatibilityCheck
            {
                Component = "ChartTimeframe",
                IsValid = tfSupported,
                Message = tfSupported
                    ? $"Chart TF {chartTf} is supported"
                    : $"Chart TF {chartTf} NOT supported (use 5m or 15m)",
                CheckedAt = DateTime.UtcNow
            });

            return _checks.All(c => c.IsValid);
        }

        public string GetValidationReport()
        {
            var report = "╔════════════════════════════════════════════════════════════╗\n";
            report += "║       HTF BIAS/SWEEP ENGINE - COMPATIBILITY REPORT       ║\n";
            report += "╚════════════════════════════════════════════════════════════╝\n\n";

            foreach (var check in _checks)
            {
                string status = check.IsValid ? "✓ PASS" : "✗ FAIL";
                report += $"{status} | {check.Component}\n";
                report += $"        {check.Message}\n\n";
            }

            bool allValid = _checks.All(c => c.IsValid);
            report += "═══════════════════════════════════════════════════════════\n";
            report += $"Overall Status: {(allValid ? "✓ COMPATIBLE - Engine Ready" : "✗ INCOMPATIBLE - Engine Disabled")}\n";
            report += "═══════════════════════════════════════════════════════════\n";

            return report;
        }

        public bool IsAllValid() => _checks.Count > 0 && _checks.All(c => c.IsValid);

        public List<CompatibilityCheck> GetFailedChecks() => _checks.Where(c => !c.IsValid).ToList();

        public List<CompatibilityCheck> GetAllChecks() => _checks;
    }
}
