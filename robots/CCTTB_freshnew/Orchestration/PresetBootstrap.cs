using System;
using System.Collections.Generic;

namespace CCTTB.Orchestration
{
    public static class PresetBootstrap
    {
        public static (List<OrchestratorPreset> presets, List<PresetSchedule> schedules) Build()
        {
            var presets = new List<OrchestratorPreset>
            {
                new OrchestratorPreset { Name = "Default", UseCooldown = false, CooldownSeconds = 0, UseMaxOpenPositionsPerSymbol = false, MaxOpenPositionsPerSymbol = 1000, UseSessionFilter = false, Focus = "", UseKillzone = true, KillzoneStartUtc = "00:00", KillzoneEndUtc = "23:59" },
                new OrchestratorPreset { Name = "Asia",    UseCooldown = true, CooldownSeconds = 10, UseMaxOpenPositionsPerSymbol = true, MaxOpenPositionsPerSymbol = 1, UseSessionFilter = true, SessionStartUtc = "23:00", SessionEndUtc = "07:30", Focus = "AsiaSweep", UseKillzone = true, KillzoneStartUtc = "00:00", KillzoneEndUtc = "23:59" },
                new OrchestratorPreset { Name = "London",  UseCooldown = true, CooldownSeconds = 3,  UseMaxOpenPositionsPerSymbol = true, MaxOpenPositionsPerSymbol = 2, UseSessionFilter = true, SessionStartUtc = "07:00", SessionEndUtc = "12:30", Focus = "LondonSweep", UseKillzone = true, KillzoneStartUtc = "00:00", KillzoneEndUtc = "23:59" },
                new OrchestratorPreset { Name = "NY",      UseCooldown = true, CooldownSeconds = 5,  UseMaxOpenPositionsPerSymbol = true, MaxOpenPositionsPerSymbol = 2, UseSessionFilter = true, SessionStartUtc = "12:30", SessionEndUtc = "20:30", Focus = "NYSweep", UseKillzone = true, KillzoneStartUtc = "00:00", KillzoneEndUtc = "23:59" }
            };

            var schedules = new List<PresetSchedule>
            {
                new PresetSchedule { PresetName = "Asia",   StartUtc = "23:00", EndUtc = "07:30", Days = new[]{ DayOfWeek.Monday, DayOfWeek.Tuesday, DayOfWeek.Wednesday, DayOfWeek.Thursday, DayOfWeek.Friday } },
                new PresetSchedule { PresetName = "London", StartUtc = "07:00", EndUtc = "12:30", Days = new[]{ DayOfWeek.Monday, DayOfWeek.Tuesday, DayOfWeek.Wednesday, DayOfWeek.Thursday, DayOfWeek.Friday } },
                new PresetSchedule { PresetName = "NY",     StartUtc = "12:30", EndUtc = "20:30", Days = new[]{ DayOfWeek.Monday, DayOfWeek.Tuesday, DayOfWeek.Wednesday, DayOfWeek.Thursday, DayOfWeek.Friday } },
            };

            return (presets, schedules);
        }
    }
}
