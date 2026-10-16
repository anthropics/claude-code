# Event Stream API

Real-time monitoring endpoint for the Web4 Governance plugin.

## Overview

The event stream provides a JSONL (JSON Lines) file that external clients can tail for real-time monitoring, alerting, and analytics.

**Stream Location**: `~/.web4/events.jsonl`

## Quick Start

### Tail the stream (real-time)
```bash
tail -f ~/.web4/events.jsonl | jq .
```

### Filter by severity
```bash
tail -f ~/.web4/events.jsonl | jq -c 'select(.severity == "alert")'
```

### Filter by event type
```bash
grep '"type":"policy_decision"' ~/.web4/events.jsonl | jq .
```

### Python consumer
```python
import json

with open("~/.web4/events.jsonl", "r") as f:
    for line in f:
        event = json.loads(line)
        if event.get("severity") == "alert":
            print(f"ALERT: {event.get('reason')}")
```

---

## Event Schema

Each line in the stream is a self-contained JSON object:

```json
{
  "type": "policy_decision",
  "timestamp": "2026-02-05T10:30:00.123456+00:00",
  "severity": "alert",
  "session_id": "sess-abc123",
  "tool": "Bash",
  "target": "rm -rf /tmp/test",
  "category": "command",
  "decision": "deny",
  "reason": "Destructive command blocked by safety preset",
  "rule_id": "deny-destructive-commands"
}
```

### Required Fields

| Field | Type | Description |
|-------|------|-------------|
| `type` | string | Event type (see Event Types below) |
| `timestamp` | string | ISO 8601 UTC timestamp |
| `severity` | string | Severity level: `debug`, `info`, `warn`, `alert`, `error` |

### Optional Context Fields

| Field | Type | Description |
|-------|------|-------------|
| `session_id` | string | Session identifier |
| `agent_id` | string | Agent/role identifier |

### Event-Specific Fields

| Field | Type | Description |
|-------|------|-------------|
| `tool` | string | Tool name (Bash, Read, Edit, etc.) |
| `target` | string | Target path, URL, or command |
| `category` | string | Tool category (file_read, file_write, command, network, etc.) |
| `decision` | string | Policy decision: `allow`, `deny`, `warn` |
| `reason` | string | Human-readable explanation |
| `rule_id` | string | ID of matched policy rule |

### Metrics Fields

| Field | Type | Description |
|-------|------|-------------|
| `duration_ms` | integer | Operation duration in milliseconds |
| `count` | integer | Generic count (rate limits, etc.) |

### Trust Fields

| Field | Type | Description |
|-------|------|-------------|
| `trust_before` | float | Trust value before update (0.0-1.0) |
| `trust_after` | float | Trust value after update (0.0-1.0) |
| `trust_delta` | float | Change in trust value |

### Error Fields

| Field | Type | Description |
|-------|------|-------------|
| `error` | string | Error message |
| `error_type` | string | Error class/type |

### Extensible Metadata

| Field | Type | Description |
|-------|------|-------------|
| `metadata` | object | Additional key-value data |

---

## Event Types

### Session Lifecycle

| Type | Severity | Description |
|------|----------|-------------|
| `session_start` | info | New session started |
| `session_end` | info | Session ended |

**Example:**
```json
{"type":"session_start","timestamp":"2026-02-05T10:00:00Z","severity":"info","session_id":"sess-abc123","metadata":{"project":"my-app","atp_budget":100}}
```

### Tool Execution

| Type | Severity | Description |
|------|----------|-------------|
| `tool_call` | info | Tool invocation started |
| `tool_result` | info | Tool completed |

**Example:**
```json
{"type":"tool_call","timestamp":"2026-02-05T10:01:00Z","severity":"info","session_id":"sess-abc123","tool":"Read","target":"/app/src/main.py","category":"file_read"}
```

### Policy Decisions

| Type | Severity | Description |
|------|----------|-------------|
| `policy_decision` | varies | Policy evaluated (info=allow, warn=warn, alert=deny) |
| `policy_violation` | alert | Policy rule violated |

**Example (deny):**
```json
{"type":"policy_decision","timestamp":"2026-02-05T10:02:00Z","severity":"alert","session_id":"sess-abc123","tool":"Bash","target":"rm -rf /","decision":"deny","reason":"Destructive command blocked by safety preset","rule_id":"deny-destructive-commands"}
```

**Example (warn):**
```json
{"type":"policy_decision","timestamp":"2026-02-05T10:03:00Z","severity":"warn","session_id":"sess-abc123","tool":"Bash","target":"rm temp.txt","decision":"warn","reason":"File deletion flagged - use with caution","rule_id":"warn-file-delete"}
```

### Rate Limiting

| Type | Severity | Description |
|------|----------|-------------|
| `rate_limit_check` | debug | Rate limit checked |
| `rate_limit_exceeded` | alert | Rate limit exceeded |

**Example:**
```json
{"type":"rate_limit_exceeded","timestamp":"2026-02-05T10:04:00Z","severity":"alert","session_id":"sess-abc123","target":"ratelimit:bash:tool","count":6,"metadata":{"max_count":5}}
```

### Trust Updates

| Type | Severity | Description |
|------|----------|-------------|
| `trust_update` | info | Agent trust level changed |

**Example:**
```json
{"type":"trust_update","timestamp":"2026-02-05T10:05:00Z","severity":"info","session_id":"sess-abc123","agent_id":"code-reviewer","trust_before":0.5,"trust_after":0.55,"trust_delta":0.05,"reason":"Successful code review"}
```

### Agent Lifecycle

| Type | Severity | Description |
|------|----------|-------------|
| `agent_spawn` | info | Agent spawned |
| `agent_complete` | info | Agent completed |

**Example:**
```json
{"type":"agent_spawn","timestamp":"2026-02-05T10:06:00Z","severity":"info","session_id":"sess-abc123","agent_id":"test-runner","metadata":{"capabilities":{"can_write":true,"can_execute":true}}}
```

### Audit Events

| Type | Severity | Description |
|------|----------|-------------|
| `audit_record` | info | Standard audit record |
| `audit_alert` | alert | High-priority audit event (credential access, etc.) |

**Example (credential access alert):**
```json
{"type":"audit_alert","timestamp":"2026-02-05T10:07:00Z","severity":"alert","session_id":"sess-abc123","tool":"Read","target":"/home/user/.aws/credentials","category":"credential_access","reason":"Credential file access detected"}
```

### System Events

| Type | Severity | Description |
|------|----------|-------------|
| `system_info` | info | System information |
| `system_error` | error | System error |

**Example:**
```json
{"type":"system_error","timestamp":"2026-02-05T10:08:00Z","severity":"error","error":"Database connection failed","error_type":"sqlite3.OperationalError"}
```

---

## Severity Levels

| Level | When Used | Action |
|-------|-----------|--------|
| `debug` | Verbose debugging | Usually filtered |
| `info` | Normal operations | Log/monitor |
| `warn` | Potential issues | Review |
| `alert` | Security events, policy violations | Immediate attention |
| `error` | System errors | Investigate |

---

## File Rotation

The stream file automatically rotates at 100MB:
- Current: `~/.web4/events.jsonl`
- Rotated: `~/.web4/events.jsonl.1`

Only one backup is kept. For long-term retention, configure an external log collector.

---

## Integration Examples

### Forward to syslog
```bash
tail -f ~/.web4/events.jsonl | while read line; do
  logger -t web4-governance "$line"
done
```

### Send alerts to Slack
```python
import json
import requests

WEBHOOK_URL = "https://hooks.slack.com/services/..."

with open("~/.web4/events.jsonl", "r") as f:
    f.seek(0, 2)  # Seek to end
    while True:
        line = f.readline()
        if line:
            event = json.loads(line)
            if event.get("severity") == "alert":
                requests.post(WEBHOOK_URL, json={
                    "text": f":warning: {event.get('type')}: {event.get('reason')}"
                })
```

### Prometheus metrics (conceptual)
```python
from prometheus_client import Counter

policy_decisions = Counter('web4_policy_decisions', 'Policy decisions', ['decision'])

# In your event consumer:
if event["type"] == "policy_decision":
    policy_decisions.labels(decision=event["decision"]).inc()
```

### Structured logging (JSON to stdout)
```bash
tail -f ~/.web4/events.jsonl | jq -c '{
  time: .timestamp,
  level: .severity,
  msg: .reason // .type,
  tool: .tool,
  session: .session_id
}'
```

---

## Configuration

The event stream can be configured when initializing:

```python
from governance.event_stream import EventStream, Severity

# Custom location and minimum severity
stream = EventStream(
    storage_path="~/.my-app/governance",
    filename="audit-events.jsonl",
    min_severity=Severity.WARN  # Only emit WARN and above
)
```

---

## Best Practices

1. **Use `tail -f`** for real-time monitoring rather than polling
2. **Filter by severity** to reduce noise (`alert` for critical events)
3. **Use `jq`** for ad-hoc queries and formatting
4. **Configure external log rotation** for long-term retention
5. **Register callbacks** for in-process alerting (low latency)

---

## Version History

| Version | Changes |
|---------|---------|
| 0.4.0 | Initial event stream API |
