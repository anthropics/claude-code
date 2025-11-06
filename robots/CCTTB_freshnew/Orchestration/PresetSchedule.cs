using System;

namespace CCTTB.Orchestration
{
    public sealed class PresetSchedule
    {
        public string PresetName { get; set; } = "Default";
        public string StartUtc   { get; set; } = "00:00";
        public string EndUtc     { get; set; } = "24:00";
        public DayOfWeek[] Days  { get; set; } = Array.Empty<DayOfWeek>();
    }
}
