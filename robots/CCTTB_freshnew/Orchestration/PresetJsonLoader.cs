using System;
using System.Collections.Generic;
using System.IO;
using System.Text.Json;

namespace CCTTB.Orchestration
{
    public static class PresetJsonLoader
    {
        public sealed class JsonRoot
        {
            public List<OrchestratorPreset> presets { get; set; }
            public List<PresetSchedule>     schedules { get; set; }
        }

        public static bool TryLoadFromFolder(string folderPath, out List<OrchestratorPreset> presets, out List<PresetSchedule> schedules, out string error)
        {
            presets = null; schedules = null; error = null;
            try
            {
                if (string.IsNullOrWhiteSpace(folderPath) || !Directory.Exists(folderPath))
                {
                    error = "Preset folder not found: " + folderPath;
                    return false;
                }

                string mergedJsonPath = Path.Combine(folderPath, "presets.json");
                string schedulesPath  = Path.Combine(folderPath, "schedules.json");

                if (File.Exists(mergedJsonPath))
                {
                    var json = File.ReadAllText(mergedJsonPath);
                    var root = JsonSerializer.Deserialize<JsonRoot>(json, new JsonSerializerOptions { PropertyNameCaseInsensitive = true });
                    if (root == null || (root.presets == null && root.schedules == null))
                    {
                        error = "presets.json exists but missing 'presets'/'schedules' arrays.";
                        return false;
                    }
                    presets = root.presets ?? new List<OrchestratorPreset>();
                    schedules = root.schedules ?? new List<PresetSchedule>();
                    return true;
                }

                // Otherwise expect separate files
                if (File.Exists(schedulesPath) && File.Exists(Path.Combine(folderPath, "presets.json")))
                {
                    var pjson = File.ReadAllText(Path.Combine(folderPath, "presets.json"));
                    var sjson = File.ReadAllText(schedulesPath);

                    presets = JsonSerializer.Deserialize<List<OrchestratorPreset>>(pjson, new JsonSerializerOptions { PropertyNameCaseInsensitive = true });
                    schedules = JsonSerializer.Deserialize<List<PresetSchedule>>(sjson, new JsonSerializerOptions { PropertyNameCaseInsensitive = true });
                    presets ??= new List<OrchestratorPreset>();
                    schedules ??= new List<PresetSchedule>();
                    return true;
                }

                error = "Could not find presets.json (or presets.json + schedules.json).";
                return false;
            }
            catch (Exception ex)
            {
                error = ex.ToString();
                return false;
            }
        }
    }
}
