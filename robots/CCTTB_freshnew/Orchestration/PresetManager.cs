using System;
using System.Collections.Generic;
using System.Linq;

namespace CCTTB.Orchestration
{
    public sealed class PresetManager
    {
        private readonly Dictionary<string, OrchestratorPreset> _presets = new(StringComparer.OrdinalIgnoreCase);
        private readonly List<PresetSchedule> _schedules = new();

        public PresetManager(IEnumerable<OrchestratorPreset> presets, IEnumerable<PresetSchedule> schedules)
        {
            foreach (var p in presets ?? System.Linq.Enumerable.Empty<OrchestratorPreset>()) _presets[p.Name] = p;
            if (schedules != null) _schedules.AddRange(schedules);
        }

        public OrchestratorPreset GetActivePreset(DateTime utcNow)
        {
            OrchestratorPreset chosen = null;
            foreach (var rule in _schedules)
            {
                if (rule.Days != null && rule.Days.Length > 0 && !System.Array.Exists(rule.Days, d => d == utcNow.DayOfWeek)) continue;
                var start = Parse(rule.StartUtc);
                var end   = Parse(rule.EndUtc);
                var tod = utcNow.TimeOfDay;
                bool inWindow = start <= end ? (tod >= start && tod < end) : (tod >= start || tod < end);
                if (!inWindow) continue;
                if (_presets.TryGetValue(rule.PresetName, out var p)) chosen = p;
            }
            if (chosen != null) return chosen;
            if (_presets.TryGetValue("Default", out var def)) return def;
            return new OrchestratorPreset { Name = "Default" };
        }

        /// <summary>
        /// Get all active presets for the current time (supports multiple concurrent presets during session overlaps)
        /// </summary>
        public List<OrchestratorPreset> GetActivePresets(DateTime utcNow)
        {
            var activePresets = new List<OrchestratorPreset>();

            foreach (var rule in _schedules)
            {
                // Check day of week filter
                if (rule.Days != null && rule.Days.Length > 0 && !System.Array.Exists(rule.Days, d => d == utcNow.DayOfWeek))
                    continue;

                // Check time window
                var start = Parse(rule.StartUtc);
                var end   = Parse(rule.EndUtc);
                var tod = utcNow.TimeOfDay;
                bool inWindow = start <= end ? (tod >= start && tod < end) : (tod >= start || tod < end);

                if (!inWindow) continue;

                // Add preset if found
                if (_presets.TryGetValue(rule.PresetName, out var p))
                {
                    activePresets.Add(p);
                }
            }

            // Fallback to default if no presets active
            if (activePresets.Count == 0)
            {
                if (_presets.TryGetValue("Default", out var def))
                    activePresets.Add(def);
                else
                    activePresets.Add(new OrchestratorPreset { Name = "Default" });
            }

            return activePresets;
        }

        private static TimeSpan Parse(string hhmm)
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
    }
}
