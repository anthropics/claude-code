# Swarm Coordination Patterns

Comprehensive guidance for coordinating multi-agent swarms to prevent conflicts and enable proactive monitoring.

## When to Activate

Activate this skill when:
- Orchestrating multiple agents working on the same codebase
- Implementing features that require parallel agent execution
- Designing workflows where agents might edit overlapping files
- Debugging swarm coordination issues

## Core Concepts

### The Problem with Uncoordinated Swarms

When multiple agents work in parallel without coordination:
1. **File Conflicts**: Multiple agents edit the same file simultaneously
2. **Merge Conflicts**: Changes overwrite each other
3. **Endless Loops**: Agents "fix" each other's code in circles
4. **Wasted Work**: Duplicate effort on same files

### Three-Pillar Solution

This skill teaches three complementary patterns:

1. **Status Polling (Fix 1)**: Orchestrator proactively monitors agent progress
2. **File Claiming (Fix 2)**: Agents claim ownership before editing
3. **Checkpoint Orchestration (Fix 5)**: Plan first, detect conflicts, then implement

## Key Files

### Coordination Files
- `.claude/swarm-status.json` - Central status tracking
- `.claude/file-claims.md` - File ownership registry
- `.claude/swarm-plans/` - Agent implementation plans

### Status File Format
```json
{
  "swarm_id": "swarm-20250115-abc123",
  "task": "Implement user authentication",
  "started": "2025-01-15T10:00:00Z",
  "phase": "implementing",
  "agents": {
    "auth-impl": {"status": "working", "last_update": "2025-01-15T10:05:00Z"},
    "db-schema": {"status": "completed", "last_update": "2025-01-15T10:03:00Z"}
  },
  "execution_order": [
    {"batch": 1, "agents": ["db-schema"], "parallel": false},
    {"batch": 2, "agents": ["auth-impl", "api-routes"], "parallel": true}
  ]
}
```

### File Claims Format
```markdown
# File Claims Registry

| Agent ID | File Path | Claimed At | Status |
|----------|-----------|------------|--------|
| auth-impl | src/auth/handler.ts | 2025-01-15T10:00:00Z | claimed |
| auth-impl | src/auth/types.ts | 2025-01-15T10:00:00Z | claimed |
| db-schema | src/db/schema.ts | 2025-01-15T10:00:00Z | released |
```

## References

- `references/status-polling.md` - Detailed polling patterns
- `references/file-claiming.md` - File ownership conventions
- `references/checkpoint-flow.md` - Phase-based orchestration
- `examples/simple-swarm.md` - Basic two-agent swarm
- `examples/complex-swarm.md` - Multi-phase feature implementation

## Quick Start

1. Use `/swarm [task]` command for full orchestrated flow
2. For manual coordination, create the three coordination files
3. Include file claiming instructions in all implementation agents
4. Launch status-checker every 30-60 seconds during execution
