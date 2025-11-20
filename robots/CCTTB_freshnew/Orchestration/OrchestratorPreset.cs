using System;

namespace CCTTB.Orchestration
{
    public sealed class OrchestratorPreset
    {
        public string Name { get; set; } = "Default";
        public bool   UseCooldown { get; set; } = false;
        public double CooldownSeconds { get; set; } = 0;
        public bool   UseMaxOpenPositionsPerSymbol { get; set; } = false;
        public int    MaxOpenPositionsPerSymbol    { get; set; } = 1000;
        public bool   UseSessionFilter { get; set; } = false;
        public string SessionStartUtc  { get; set; } = "00:00";
        public string SessionEndUtc    { get; set; } = "24:00";
        public string Focus { get; set; } = "";

        // Killzone settings (automatic per preset)
        public bool   UseKillzone { get; set; } = false;
        public string KillzoneStartUtc { get; set; } = "00:00";
        public string KillzoneEndUtc { get; set; } = "24:00";
    }
}
