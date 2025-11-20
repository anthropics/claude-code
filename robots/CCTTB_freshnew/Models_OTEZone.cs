using System;

namespace CCTTB
{
    public class OTEZone
    {
        public DateTime Time { get; set; }
        public BiasDirection Direction { get; set; }

        public double OTE618 { get; set; }
        public double OTE79  { get; set; }

        // Impulse that created the OTE (swing start/end)
        public double ImpulseStart { get; set; }
        public double ImpulseEnd   { get; set; }

        // Helpers (handy for drawing)
        public double Low  => Math.Min(OTE618, OTE79);
        public double High => Math.Max(OTE618, OTE79);
        public double Mid  => (Low + High) * 0.5;
    }
}
