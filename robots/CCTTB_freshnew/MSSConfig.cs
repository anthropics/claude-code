namespace CCTTB
{
    public enum MSSBreakType { Both, WickOnly, BodyPercentOnly }

    public class MSSConfig
    {
        public string TimeframeLabel { get; set; } = "M5";
        public int    SwingLookback  { get; set; } = 1;
        public double MinDisplacementATR { get; set; } = 1.2;
        public double MinBodyRatio        { get; set; } = 0.6;
        public bool   FvgRequired         { get; set; } = true;
        public int    RetestTimeoutBars   { get; set; } = 50;
        public int    LiqSweepLookback    { get; set; } = 5;

        public MSSBreakType BreakType     { get; set; } = MSSBreakType.Both;
        public double WickThresholdPct    { get; set; } = 25;
        public double BodyPercentThreshold{ get; set; } = 60;
        public double BothThresholdPct    { get; set; } = 65;

        public bool   RequireHtfBias      { get; set; } = true;

        // NEW: minimum A↔C gap (in absolute price units); set to 0 to disable filter
        public double MinFvgGapAbs        { get; set; } = 0.0;
        // Displacement enhancement per videos: break distance >= max(ATR factor, Median TR factor)
        public bool   UseMedianDisplacement    { get; set; } = true;
        public int    DisplacementMedianWindow { get; set; } = 10;
        public double DisplacementMedianFactor { get; set; } = 1.25;
    }
}


