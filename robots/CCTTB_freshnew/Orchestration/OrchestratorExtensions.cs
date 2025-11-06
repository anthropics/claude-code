using System;
using System.Collections.Generic;
using System.Linq;

namespace CCTTB.Orchestration
{
    public static class OrchestratorExtensions
    {
        public static void ApplyPreset(this Orchestrator orc, OrchestratorPreset p)
        {
            if (orc == null || p == null) return;
            orc.UseCooldown = p.UseCooldown;
            orc.Cooldown    = TimeSpan.FromSeconds(Math.Max(0, p.CooldownSeconds));
            orc.UseMaxOpenPositionsPerSymbol = p.UseMaxOpenPositionsPerSymbol;
            orc.MaxOpenPositionsPerSymbol    = Math.Max(1, p.MaxOpenPositionsPerSymbol);
            orc.UseSessionFilter             = p.UseSessionFilter;
            orc.SessionStart = ParseTime(p.SessionStartUtc);
            orc.SessionEnd   = ParseTime(p.SessionEndUtc);
        }

        public static TimeSpan ParseTime(string hhmm)
        {
            if (string.IsNullOrWhiteSpace(hhmm)) return TimeSpan.Zero;
            var parts = hhmm.Split(':');
            if (parts.Length != 2) return TimeSpan.Zero;
            int h = int.TryParse(parts[0], out var hh) ? hh : 0;
            int m = int.TryParse(parts[1], out var mm) ? mm : 0;
            h = Math.Clamp(h, 0, 24);
            m = Math.Clamp(m, 0, 59);
            return new TimeSpan(h, m, 0);
        }

        /// <summary>
        /// Get combined killzone from all active presets that use killzones.
        /// Returns the union of all killzone times (earliest start, latest end).
        /// </summary>
        public static (bool useKillzone, TimeSpan start, TimeSpan end) GetCombinedKillzone(List<OrchestratorPreset> activePresets)
        {
            if (activePresets == null || activePresets.Count == 0)
                return (false, TimeSpan.Zero, TimeSpan.FromHours(24));

            var killzonePresets = activePresets.Where(p => p.UseKillzone).ToList();
            if (killzonePresets.Count == 0)
                return (false, TimeSpan.Zero, TimeSpan.FromHours(24));

            // Get union of all killzone times (earliest start, latest end)
            TimeSpan earliestStart = killzonePresets.Min(p => ParseTime(p.KillzoneStartUtc));
            TimeSpan latestEnd = killzonePresets.Max(p => ParseTime(p.KillzoneEndUtc));

            return (true, earliestStart, latestEnd);
        }

        /// <summary>
        /// Check if current time is within ANY active preset's killzone
        /// </summary>
        public static bool IsInAnyKillzone(List<OrchestratorPreset> activePresets, TimeSpan currentTimeOfDay)
        {
            if (activePresets == null || activePresets.Count == 0)
                return true; // No presets = always allow

            foreach (var preset in activePresets)
            {
                if (!preset.UseKillzone) continue; // This preset doesn't use killzone

                var start = ParseTime(preset.KillzoneStartUtc);
                var end = ParseTime(preset.KillzoneEndUtc);

                bool inWindow = start <= end
                    ? (currentTimeOfDay >= start && currentTimeOfDay < end)
                    : (currentTimeOfDay >= start || currentTimeOfDay < end);

                if (inWindow) return true; // Found at least one killzone that matches
            }

            return false; // Not in any killzone
        }
    }
}
