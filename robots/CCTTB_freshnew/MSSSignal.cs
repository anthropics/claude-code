
using System;

namespace CCTTB
{
    public enum MSSType { Bullish, Bearish }

    // Unified MSSSignal used across the project. This class includes both
    // the richer properties (BreakIndex/BreakTime etc.) and the convenience
    // anchors/OTE fields used by visualizers and entry logic.
    public class MSSSignal
    {
        // Rich model fields
        public bool IsValid { get; set; }
        public MSSType Type { get; set; }
        public int BreakIndex { get; set; }
        public DateTime BreakTime { get; set; }
        public double BreakLevel { get; set; }
        public bool HasFVG { get; set; }
        public bool HadLiquiditySweep { get; set; }
        public (double low, double high)? FOIRange { get; set; }
        public int ValidUntilIndex { get; set; }
        public string Note { get; set; }

        // Convenience aliases / fields used by other modules
        public int Index { get => BreakIndex; set => BreakIndex = value; }
        public double Price { get => BreakLevel; set => BreakLevel = value; }
        public BiasDirection Direction { get => (Type == MSSType.Bullish) ? BiasDirection.Bullish : BiasDirection.Bearish; set => Type = (value == BiasDirection.Bullish) ? MSSType.Bullish : MSSType.Bearish; }
        public DateTime Time { get => BreakTime; set => BreakTime = value; }

        // OTE / body metadata
        public double BodyPercent { get; set; }
        public double WickPercent { get; set; }
        public double CombinedPercent { get; set; }
        public int Score { get; set; }

        // Fib/EQ/OTE pack anchors
        public double SwingHigh { get; set; }
        public double SwingLow { get; set; }
        public DateTime SwingHighTime { get; set; }
        public DateTime SwingLowTime { get; set; }
        public double ImpulseStart { get; set; }
        public double ImpulseEnd { get; set; }
    }
}
