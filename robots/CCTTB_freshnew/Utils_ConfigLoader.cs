using System;
using System.IO;
using System.Text.Json;
using System.Collections.Generic;

namespace CCTTB
{
    public class ActiveConfig
    {
        public Scoring scoring { get; set; } = new Scoring();
        public Risk risk { get; set; } = new Risk();
        public string orchestratorStamp { get; set; } = "none";

        // NEW: High-impact changes config blocks
        public OteAdaptive oteAdaptive { get; set; } = new OteAdaptive();
        public TpGovernor tpGovernor { get; set; } = new TpGovernor();
        public OteTapFallback oteTapFallback { get; set; } = new OteTapFallback();
        public LearningAdjustments learningAdjustments { get; set; } = new LearningAdjustments();
        public Gates gates { get; set; } = new Gates();
        public Orchestrator orchestrator { get; set; } = new Orchestrator();

        public class Scoring
        {
            public Weights weights { get; set; } = new Weights();
            public class Weights
            {
                public double w_session { get; set; } = 0.20;
                public double w_vol     { get; set; } = 0.40;
                public double w_spread  { get; set; } = 0.30;
                public double w_news    { get; set; } = 0.30;
            }
        }

        public class Risk
        {
            public double multiplier { get; set; } = 0.85;
        }

        // NEW: OTE Adaptive tolerance configuration
        public class OteAdaptive
        {
            public bool enabled { get; set; } = false;
            public BaseConfig @base { get; set; } = new BaseConfig();
            public MissStreakAutoRelax missStreakAutoRelax { get; set; } = new MissStreakAutoRelax();
            public RetapMarketConversion retapMarketConversion { get; set; } = new RetapMarketConversion();

            public class BaseConfig
            {
                public string mode { get; set; } = "atr";
                public int period { get; set; } = 14;
                public double multiplier { get; set; } = 0.18;
                public double roundTo { get; set; } = 0.1;
                public List<double> bounds { get; set; } = new List<double> { 0.9, 1.8 };
            }

            public class MissStreakAutoRelax
            {
                public bool enabled { get; set; } = false;
                public int triggerMisses { get; set; } = 4;
                public double stepPips { get; set; } = 0.2;
                public double maxExtraPips { get; set; } = 0.6;
                public List<string> resetOn { get; set; } = new List<string> { "tap", "session_change" };
            }

            public class RetapMarketConversion
            {
                public bool enabled { get; set; } = false;
                public double withinPips { get; set; } = 0.3;
                public double maxSlippagePips { get; set; } = 0.2;
            }
        }

        // NEW: TP Governor (state-aware MinRR)
        public class TpGovernor
        {
            public bool enabled { get; set; } = false;
            public StateMinRR stateMinRR { get; set; } = new StateMinRR();
            public List<string> targetPriority { get; set; } = new List<string> { "OppositeLiquidity", "RecentSwing", "SessionExtreme", "IFVGEdge", "OBEdge" };
            public NearMissRule nearMissRule { get; set; } = new NearMissRule();

            public class StateMinRR
            {
                public double trending { get; set; } = 1.8;
                public double ranging { get; set; } = 1.1;
                public double @volatile { get; set; } = 1.4;
                public double quiet { get; set; } = 1.1;
            }

            public class NearMissRule
            {
                public bool enabled { get; set; } = false;
                public double threshold { get; set; } = 0.8;
                public ActionConfig action { get; set; } = new ActionConfig();

                public class ActionConfig
                {
                    public double riskMultiplier { get; set; } = 0.7;
                    public List<PartialConfig> partials { get; set; } = new List<PartialConfig>();
                    public TrailingConfig trailing { get; set; } = new TrailingConfig();

                    public class PartialConfig
                    {
                        public double rr { get; set; } = 0.8;
                        public int percent { get; set; } = 35;
                    }

                    public class TrailingConfig
                    {
                        public double activateRR { get; set; } = 1.2;
                        public int stepPips { get; set; } = 5;
                    }
                }
            }
        }

        // NEW: OTE Tap Fallback
        public class OteTapFallback
        {
            public bool enabled { get; set; } = false;
            public string when { get; set; } = "tp_reject_after_tap";
            public List<string> @try { get; set; } = new List<string> { "OrderBlock", "IFVG" };
            public double confidencePenalty { get; set; } = 0.15;
            public double minRRPenalty { get; set; } = 0.2;
            public bool enterIfMeetsStateMinRR { get; set; } = true;
        }

        // NEW: Learning Adjustments
        public class LearningAdjustments
        {
            public int recalcEveryTrades { get; set; } = 10;
            public double confluenceWeightStep { get; set; } = 0.1;
            public double maxTotalShift { get; set; } = 0.3;
            public ReduceStateMinRROnRepeatedTPRejects reduceStateMinRROnRepeatedTPRejects { get; set; } = new ReduceStateMinRROnRepeatedTPRejects();

            public class ReduceStateMinRROnRepeatedTPRejects
            {
                public int threshold { get; set; } = 5;
                public double delta { get; set; } = 0.1;
                public int applyToNext { get; set; } = 3;
                public FloorsConfig floors { get; set; } = new FloorsConfig();

                public class FloorsConfig
                {
                    public double ranging { get; set; } = 1.0;
                    public double quiet { get; set; } = 1.0;
                }
            }
        }

        // NEW: Gates configuration
        public class Gates
        {
            public bool relaxAll { get; set; } = true;
            public bool sequenceGate { get; set; } = false;
            public bool pullbackRequirement { get; set; } = false;
            public bool microBreakGate { get; set; } = false;
            public bool killzoneStrict { get; set; } = false;
            public string mssOppLiqGate { get; set; } = "soft";
            public bool dailyBiasVeto { get; set; } = false;
            public bool allowCounterTrend { get; set; } = true;
        }

        // NEW: Orchestrator configuration
        public class Orchestrator
        {
            public bool enabled { get; set; } = false;
            public int reassessEveryBars { get; set; } = 20;
            public StateDetection stateDetection { get; set; } = new StateDetection();
            public Dictionary<string, string> presetMap { get; set; } = new Dictionary<string, string>();
            public bool smoothSwitch { get; set; } = true;

            public class StateDetection
            {
                public AdxThresholds adxThresholds { get; set; } = new AdxThresholds();
                public double atrSpike { get; set; } = 1.3;

                public class AdxThresholds
                {
                    public double trend { get; set; } = 25;
                    public double range { get; set; } = 20;
                }
            }
        }
    }

    public static class ConfigLoader
    {
        public static ActiveConfig LoadActiveConfig(string path)
        {
            try
            {
                var json = File.ReadAllText(path);
                var cfg = JsonSerializer.Deserialize<ActiveConfig>(json,
                    new JsonSerializerOptions { PropertyNameCaseInsensitive = true });
                return cfg ?? new ActiveConfig();
            }
            catch
            {
                return new ActiveConfig(); // fail-open defaults
            }
        }
    }
}
