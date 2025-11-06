using cAlgo.API;
using System;
using System.Collections.Generic;
using System.Linq;
using System.Text.Json;

namespace CCTTB
{
    public class OrchestratorEvent
    {
        public string EventType { get; set; }
        public DateTime Timestamp { get; set; } = DateTime.UtcNow;
        public Dictionary<string, object> Data { get; set; } = new Dictionary<string, object>();
    }

    public class GateStatus
    {
        public string Module { get; set; }
        public bool IsOpen { get; set; }
        public string Reason { get; set; }
        public DateTime LastChanged { get; set; }
    }

    public class OrchestratorGate
    {
        private readonly Robot _bot;
        private readonly StrategyConfig _config;
        private readonly string _logPath;

        private Dictionary<string, GateStatus> _gates = new Dictionary<string, GateStatus>();
        private List<OrchestratorEvent> _eventHistory = new List<OrchestratorEvent>();
        private bool _initialized = false;

        public OrchestratorGate(Robot bot, StrategyConfig config, string logPath = null)
        {
            _bot = bot;
            _config = config;
            _logPath = logPath;

            // Initialize gates
            _gates["MSS"] = new GateStatus
            {
                Module = "MSS",
                IsOpen = false,
                Reason = "not_initialized",
                LastChanged = DateTime.UtcNow
            };

            _initialized = true;
        }

        public bool IsInitialized() => _initialized;

        // ═══════════════════════════════════════════════════════════════════
        // GATE CONTROL
        // ═══════════════════════════════════════════════════════════════════

        public void OpenGate(string module, string reason)
        {
            if (!_gates.ContainsKey(module))
            {
                _gates[module] = new GateStatus { Module = module };
            }

            var gate = _gates[module];
            if (gate.IsOpen)
            {
                if (_config.EnableDebugLogging)
                    _bot.Print($"[OrchestratorGate] Gate {module} already OPEN");
                return; // Already open
            }

            gate.IsOpen = true;
            gate.Reason = reason;
            gate.LastChanged = DateTime.UtcNow;

            EmitEvent(new OrchestratorEvent
            {
                EventType = "gate_open",
                Data = new Dictionary<string, object>
                {
                    { "module", module },
                    { "reason", reason },
                    { "time", DateTime.UtcNow }
                }
            });

            if (_config.EnableDebugLogging)
                _bot.Print($"[OrchestratorGate] Gate {module} OPENED (reason: {reason})");
        }

        public void CloseGate(string module, string reason)
        {
            if (!_gates.ContainsKey(module)) return;

            var gate = _gates[module];
            if (!gate.IsOpen)
            {
                if (_config.EnableDebugLogging)
                    _bot.Print($"[OrchestratorGate] Gate {module} already CLOSED");
                return;
            }

            gate.IsOpen = false;
            gate.Reason = reason;
            gate.LastChanged = DateTime.UtcNow;

            EmitEvent(new OrchestratorEvent
            {
                EventType = "gate_close",
                Data = new Dictionary<string, object>
                {
                    { "module", module },
                    { "reason", reason },
                    { "time", DateTime.UtcNow }
                }
            });

            if (_config.EnableDebugLogging)
                _bot.Print($"[OrchestratorGate] Gate {module} CLOSED (reason: {reason})");
        }

        public bool IsGateOpen(string module)
        {
            if (!_gates.ContainsKey(module)) return false;
            return _gates[module].IsOpen;
        }

        public GateStatus GetGateStatus(string module)
        {
            if (!_gates.ContainsKey(module)) return null;
            return _gates[module];
        }

        // ═══════════════════════════════════════════════════════════════════
        // EVENT EMISSION
        // ═══════════════════════════════════════════════════════════════════

        public void EmitEvent(OrchestratorEvent evt)
        {
            // Add to history
            _eventHistory.Add(evt);

            // Keep only last 1000 events
            if (_eventHistory.Count > 1000)
                _eventHistory.RemoveAt(0);

            // Serialize to JSON
            string json = SerializeEvent(evt);

            // Log to console if debug enabled
            if (_config.EnableDebugLogging)
                _bot.Print($"[OrchestratorEvent] {json}");

            // TODO: Send to external orchestrator via webhook/queue
            // For now, just log to file if path provided
            if (!string.IsNullOrEmpty(_logPath))
            {
                try
                {
                    System.IO.File.AppendAllText(_logPath, json + Environment.NewLine);
                }
                catch (Exception ex)
                {
                    _bot.Print($"[OrchestratorGate] Failed to write event to log: {ex.Message}");
                }
            }
        }

        private string SerializeEvent(OrchestratorEvent evt)
        {
            try
            {
                var payload = new Dictionary<string, object>
                {
                    { "event", evt.EventType },
                    { "timestamp", evt.Timestamp.ToString("o") } // ISO-8601
                };

                // Merge data
                foreach (var kvp in evt.Data)
                {
                    payload[kvp.Key] = kvp.Value;
                }

                return JsonSerializer.Serialize(payload, new JsonSerializerOptions
                {
                    WriteIndented = false
                });
            }
            catch (Exception ex)
            {
                _bot.Print($"[OrchestratorGate] JSON serialization failed: {ex.Message}");
                return $"{{\"event\":\"{evt.EventType}\",\"error\":\"serialization_failed\"}}";
            }
        }

        // ═══════════════════════════════════════════════════════════════════
        // HANDSHAKE & COMPATIBILITY
        // ═══════════════════════════════════════════════════════════════════

        public void PerformHandshake(string version, string tfMapChecksum, string thresholdsChecksum)
        {
            EmitEvent(new OrchestratorEvent
            {
                EventType = "handshake_request",
                Data = new Dictionary<string, object>
                {
                    { "module", "BiasSweepEngine" },
                    { "version", version },
                    { "tf_map_checksum", tfMapChecksum },
                    { "thresholds_checksum", thresholdsChecksum },
                    { "time", DateTime.UtcNow }
                }
            });

            // TODO: Wait for handshake_ack from orchestrator
            // For now, assume compatible
            if (_config.EnableDebugLogging)
                _bot.Print($"[OrchestratorGate] Handshake sent (version: {version})");
        }

        public void EmitCompatibilityReport(string status, List<string> issues = null)
        {
            EmitEvent(new OrchestratorEvent
            {
                EventType = "compatibility_report",
                Data = new Dictionary<string, object>
                {
                    { "status", status }, // "ok", "warning", "error"
                    { "issues", issues ?? new List<string>() },
                    { "time", DateTime.UtcNow }
                }
            });
        }

        // ═══════════════════════════════════════════════════════════════════
        // STATISTICS
        // ═══════════════════════════════════════════════════════════════════

        public int GetEventCount() => _eventHistory.Count;

        public int GetEventCount(string eventType)
        {
            return _eventHistory.Count(e => e.EventType == eventType);
        }

        public List<OrchestratorEvent> GetRecentEvents(int count = 10)
        {
            return _eventHistory.TakeLast(count).ToList();
        }

        public void ClearHistory()
        {
            _eventHistory.Clear();
        }
    }
}
