# Swarm Coordination Plugin

Coordinate multi-agent swarms with conflict prevention, status polling, and checkpoint-based orchestration.

## The Problem

When multiple agents work in parallel on the same codebase, they can:
- Edit the same files simultaneously, creating conflicts
- Make changes that overwrite each other
- Get stuck in endless loops trying to "fix" each other's code
- Waste effort with duplicate work

## The Solution

This plugin implements three complementary coordination patterns:

### 1. Status Polling (Proactive Monitoring)

The orchestrator periodically spawns lightweight status-checker agents to monitor swarm health:
- Detect stuck or failed agents early
- Identify file conflicts as they emerge
- Enable dynamic load balancing
- Provide real-time progress visibility

### 2. File Claiming (Ownership Convention)

Agents claim file ownership before editing:
- Prevents multiple agents from editing the same file
- Clear ownership registry in `.claude/file-claims.md`
- Agents skip files claimed by others
- Claims released after completion

### 3. Checkpoint-Based Orchestration (Phased Execution)

Separate swarm execution into controlled phases:
1. **Planning** - Agents analyze and plan (read-only, parallel)
2. **Review** - Detect conflicts before implementation
3. **Resolution** - Resolve conflicts with user input
4. **Implementation** - Execute with monitoring
5. **Verification** - Validate results

## Quick Start

### Using the `/swarm` Command

```
/swarm Implement user authentication with JWT tokens and session management
```

The command will guide you through:
1. Initializing coordination files
2. Launching planning agents
3. Reviewing and resolving conflicts
4. Executing implementation with monitoring
5. Verifying completion

### Manual Coordination

For custom workflows, use the individual components:

1. Create coordination files:
   - `.claude/swarm-status.json`
   - `.claude/file-claims.md`
   - `.claude/swarm-plans/`

2. Include file claiming instructions in agent prompts

3. Launch status-checker periodically during execution

## Plugin Contents

### Commands
- `/swarm [task]` - Full orchestrated swarm workflow

### Agents
- `status-checker` - Monitors swarm health (haiku, fast)
- `conflict-detector` - Analyzes plans for conflicts
- `plan-reviewer` - Validates individual agent plans

### Skills
- `swarm-patterns` - Documentation and examples

## Coordination Files

### `.claude/swarm-status.json`
```json
{
  "swarm_id": "feature-impl-001",
  "task": "Implement new feature",
  "phase": "implementing",
  "agents": {
    "agent-1": {"status": "working"},
    "agent-2": {"status": "completed"}
  }
}
```

### `.claude/file-claims.md`
```markdown
| Agent ID | File Path | Claimed At | Status |
|----------|-----------|------------|--------|
| agent-1 | src/api/handler.ts | 2025-01-15T10:00:00Z | claimed |
| agent-2 | src/db/schema.ts | 2025-01-15T10:00:00Z | released |
```

## Best Practices

1. **Always use planning phase** - Never skip to implementation
2. **Resolve all conflicts** - Don't proceed with overlapping claims
3. **Poll regularly** - Every 30-60 seconds during execution
4. **Use haiku for status checks** - Fast and cheap
5. **Release claims promptly** - Don't hold after completion

## When to Use

Use this plugin when:
- Multiple agents need to work on the same codebase
- Tasks require parallel execution for speed
- You've experienced agent conflicts before
- You need visibility into swarm progress

## When NOT to Use

Skip this plugin when:
- Single agent is sufficient
- Agents work on completely separate codebases
- Tasks are purely read-only (no file modifications)

## Troubleshooting

### Agents Still Conflict
- Ensure all agents include file claiming instructions
- Verify conflict detection ran before implementation
- Check that claims registry is being read

### Status Checker Shows Stuck Agents
- Check agent logs for errors
- Consider increasing timeout
- May need to reassign work

### Claims Not Releasing
- Verify agent completion is being tracked
- Manually update claims if needed
- Check for orchestrator errors

## Learn More

See the `swarm-patterns` skill for detailed documentation:
- `references/status-polling.md` - Polling patterns
- `references/file-claiming.md` - Claiming conventions
- `references/checkpoint-flow.md` - Phased orchestration
- `examples/simple-swarm.md` - Complete example
