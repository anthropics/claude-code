using System;

namespace CCTTB
{
    public enum LiquidityZoneType { Supply, Demand }

    public class LiquidityZone
    {
        public DateTime Start { get; set; }
        public DateTime End   { get; set; }
        public double Low     { get; set; }
        public double High    { get; set; }
        public LiquidityZoneType Type { get; set; }
        public string Label   { get; set; }

        public bool Bullish => Type == LiquidityZoneType.Demand;

        // --- Entry Tool Confluence (ICT Liquidity-First Approach) ---
        // These properties indicate which entry tools overlap with this liquidity zone
        public bool HasOrderBlock { get; set; } = false;
        public bool HasOTE { get; set; } = false;
        public bool HasFVG { get; set; } = false;
        public bool HasBreakerBlock { get; set; } = false;

        // IsEntryReady = true if this liquidity zone has at least one entry tool
        // This marks "strong, reliable liquidity with entry confirmation"
        public bool IsEntryReady => HasOrderBlock || HasOTE || HasFVG || HasBreakerBlock;

        // --- Helpers ---
        public double Mid  => (Low + High) * 0.5;
        public double Range => High - Low;
        public bool IsActive(DateTime t) => t >= Start && t <= End;
        public string Id => $"LQZ_{Start.Ticks}";
    }
}
