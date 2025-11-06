using System;
using cAlgo.API;

namespace CCTTB
{
    /// <summary>
    /// Simplified phased policy loader with hardcoded defaults.
    /// Use this until JSON parsing is available.
    /// </summary>
    public class PhasedPolicySimple
    {
        private readonly Robot _bot;

        public PhasedPolicySimple(Robot bot)
        {
            _bot = bot;
        }

        // ATR Configuration
        public int GetATRPeriod() => 17;
        public double GetATRMultiplier(string tf) => tf == "15m" ? 0.25 : (tf == "5m" ? 0.20 : 0.30);
        public int GetMinBufferPips(string tf) => tf == "15m" ? 3 : (tf == "5m" ? 2 : 5);
        public int GetMaxBufferPips(string tf) => tf == "15m" ? 20 : (tf == "5m" ? 10 : 30);
        public bool RequireBodyClose() => true;
        public bool RequireDisplacement() => true;
        public double MinDisplacementFactor() => 1.5;

        // OTE Configuration
        public bool OTEEnabled() => true;
        public double OTEFibMin() => 0.618;
        public double OTEFibMax() => 0.79;
        public double OTESweetSpot() => 0.705;
        public double OTEEquilibrium() => 0.50;
        public int OTEProximityPips() => 5;
        public double OTEInvalidationPercent() => 0.88;

        // Risk Configuration
        public double MaxDailyRiskPercent() => 6.0;
        public double BaseRiskPercent() => 0.4;

        // Phase 1 Risk
        public double Phase1RiskPercent() => 0.2;
        public double Phase1RiskMultiplier() => 0.5;
        public double Phase1RewardRiskTarget() => 2.0;
        public int Phase1MaxAttempts() => 2;

        // Phase 3 Risk
        public double Phase3RiskPercent() => 0.6;
        public double Phase3RiskMultiplier() => 1.5;
        public double Phase3RewardRiskTarget() => 3.0;
        public int Phase3MaxAttempts() => 1;
        public bool Phase3AllowIndependent() => true;

        // Phase 3 Conditional Risk Multipliers
        public double GetPhase3RiskMultiplier(string condition)
        {
            switch (condition)
            {
                case "noPhase1":
                    return 1.5;  // 0.6% × 1.5 = 0.9%
                case "afterPhase1Success":
                    return 1.5;  // 0.6% × 1.5 = 0.9%
                case "afterPhase1Failure1x":
                    return 0.5;  // 0.6% × 0.5 = 0.3%
                default:
                    return 1.0;
            }
        }

        public bool GetPhase3Allowed(string condition)
        {
            return condition != "afterPhase1Failure2x";  // Block if 2× failures
        }

        // Cascade Configuration
        public int GetCascadeTimeout(string cascadeName)
        {
            return cascadeName == "DailyBias" ? 240 : 60;  // 240min for daily, 60min for intraday
        }

        public string GetBiasSource() => "DailyBias";
        public string GetExecutionSource() => "IntradayExecution";

        // Debug
        public bool EnableDebugLogging() => true;

        public void PrintSummary()
        {
            _bot.Print("╔════════════════════════════════════════╗");
            _bot.Print("║   PHASED STRATEGY POLICY (SIMPLE)     ║");
            _bot.Print("╚════════════════════════════════════════╝");
            _bot.Print($"ATR Period: {GetATRPeriod()}");
            _bot.Print($"OTE Zone: {OTEFibMin():P1} - {OTEFibMax():P1}");
            _bot.Print($"Phase 1 Risk: {Phase1RiskPercent()}%");
            _bot.Print($"Phase 3 Risk: {Phase3RiskPercent()}%");
            _bot.Print($"Max Daily Risk: {MaxDailyRiskPercent()}%");
            _bot.Print("╚════════════════════════════════════════╝");
        }
    }
}
