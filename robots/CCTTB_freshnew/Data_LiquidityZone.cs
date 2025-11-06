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

        // --- Helpers ---
        public double Mid  => (Low + High) * 0.5;
        public double Range => High - Low;
        public bool IsActive(DateTime t) => t >= Start && t <= End;
        public string Id => $"LQZ_{Start.Ticks}";
    }
}
