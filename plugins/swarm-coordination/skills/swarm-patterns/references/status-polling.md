# Status Polling Pattern

Proactive orchestrator monitoring for swarm health and conflict detection.

## Overview

Instead of fire-and-forget agent launching, the orchestrator periodically spawns lightweight "status checker" agents to monitor swarm progress and identify issues early.

## Why Polling Matters

Without polling:
- Orchestrator has no visibility into agent progress
- Conflicts discovered only after damage is done
- Stuck agents waste time until final timeout
- No opportunity for mid-execution corrections

With polling:
- Real-time visibility into agent status
- Conflicts detected and resolved quickly
- Stuck agents identified and reassigned
- Dynamic load balancing possible

## Polling Schedule

### Recommended Intervals

| Phase | Interval | Reason |
|-------|----------|--------|
| Initial launch | 30 seconds | Catch early failures fast |
| Active execution | 45-60 seconds | Balance visibility vs overhead |
| Near completion | 30 seconds | Ensure clean handoffs |
| Post-completion | Immediate | Verify success, launch next batch |

### Adaptive Polling

Adjust frequency based on:
- **More frequent**: High-conflict swarms, many parallel agents
- **Less frequent**: Simple tasks, sequential execution
- **Immediate**: After any agent reports an issue

## Status Checker Agent

The status-checker agent is designed for fast, lightweight execution:

```yaml
model: haiku  # Fast and cheap
tools: Read, Glob, Grep  # Read-only, no edits
```

### What It Checks

1. **Agent Status**
   - Last update timestamp
   - Current task progress
   - Reported errors or warnings

2. **File Claims**
   - Ownership conflicts
   - Stale claims from completed agents
   - Unclaimed files being edited

3. **Overall Health**
   - Completion percentage
   - Estimated time remaining
   - Bottlenecks and blockers

### Output Format

```json
{
  "timestamp": "2025-01-15T10:35:00Z",
  "overall_health": "warning",
  "completion_percentage": 65,
  "issues": {
    "conflicts": [{
      "file": "src/api/handler.ts",
      "agents": ["agent-1", "agent-3"],
      "severity": "critical"
    }],
    "stuck_agents": [{
      "id": "agent-2",
      "last_update": "2025-01-15T10:30:00Z",
      "duration_seconds": 300
    }]
  },
  "recommendations": [
    {"action": "pause", "target": "agent-3", "reason": "resolve conflict"}
  ]
}
```

## Responding to Status Reports

### Healthy Status
```json
{"overall_health": "healthy"}
```
- Continue execution
- Schedule next poll at normal interval

### Warning Status
```json
{"overall_health": "warning", "issues": {...}}
```
- Review specific issues
- Take corrective action if needed
- Increase polling frequency temporarily

### Critical Status
```json
{"overall_health": "critical", "issues": {...}}
```
- Pause affected agents immediately
- Resolve conflicts before continuing
- Consider notifying user for input

## Implementation Example

```markdown
## During Implementation Phase

1. Launch batch 1 agents (agent-1, agent-2)
2. Wait 30 seconds
3. Launch status-checker agent
4. If healthy: continue, schedule next check in 45 seconds
5. If issues:
   - Conflicts: Pause later agent, let first complete
   - Stuck: Check logs, consider timeout or reassignment
   - Failed: Report to user, decide on retry/skip
6. Repeat until all agents complete
```

## Polling vs Event-Driven

| Approach | Pros | Cons |
|----------|------|------|
| Polling | Simple, no agent modification needed | Some latency in detection |
| Events | Immediate detection | Requires agent cooperation |

This plugin uses polling because:
- Works with any agent without modification
- Orchestrator maintains full control
- Simpler implementation
- Haiku model makes polling cheap

## Best Practices

1. **Use haiku for status checks** - Fast and cheap
2. **Don't poll too frequently** - 30 seconds minimum
3. **Act on issues promptly** - Don't just log and continue
4. **Track polling history** - Useful for debugging
5. **Combine with file claims** - Polling detects, claims prevent
