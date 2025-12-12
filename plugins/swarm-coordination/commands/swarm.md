---
description: Coordinate multi-agent swarm with conflict prevention, status polling, and checkpoint-based orchestration
argument-hint: [task description]
---

# Coordinated Swarm Orchestration

You are orchestrating a multi-agent swarm to complete a complex task. Follow this checkpoint-based workflow to prevent conflicts and enable proactive monitoring.

## Task Description
$ARGUMENTS

---

## Phase 1: Initialization

**Goal**: Set up swarm coordination infrastructure

**Actions**:
1. Create coordination files:
   - `.claude/swarm-status.json` - Agent status tracking
   - `.claude/file-claims.md` - File ownership registry
   - `.claude/swarm-plans/` - Directory for agent plans

2. Initialize status file:
```json
{
  "swarm_id": "[generated-id]",
  "task": "[task description]",
  "started": "[timestamp]",
  "phase": "planning",
  "agents": {}
}
```

3. Initialize file claims:
```markdown
# File Claims Registry

| Agent ID | File Path | Claimed At | Status |
|----------|-----------|------------|--------|
```

4. Create todo list tracking all phases

---

## Phase 2: Planning (Parallel, Read-Only)

**Goal**: Have multiple agents analyze the codebase and create implementation plans WITHOUT making changes

**Actions**:
1. Launch 2-4 planning agents in parallel, depending on task complexity. Each agent should:
   - Analyze a different aspect of the task
   - Create a detailed implementation plan
   - List ALL files they intend to modify/create/delete
   - Identify dependencies on other files or agents
   - **CRITICAL**: Agents must NOT edit any files - planning only

2. Each agent writes their plan to `.claude/swarm-plans/[agent-id].md`:
```markdown
## Agent Plan: [agent-id]

### Task Summary
[What this agent will accomplish]

### Files to Modify
- `path/to/file.ts`: [Description of changes]

### Files to Create
- `path/to/new-file.ts`: [Purpose]

### Dependencies
- Requires: [what this depends on]
- Blocks: [what depends on this]

### Implementation Steps
1. [Step 1]
2. [Step 2]
```

3. Update swarm status as agents complete:
```json
{
  "agents": {
    "agent-1": {"status": "plan_complete", "plan_file": ".claude/swarm-plans/agent-1.md"}
  }
}
```

---

## Phase 3: Conflict Detection

**Goal**: Review all plans and identify conflicts before implementation

**Actions**:
1. Wait for ALL planning agents to complete
2. Read all plans from `.claude/swarm-plans/`
3. Launch the **conflict-detector** agent to analyze all plans
4. Review the conflict report

**If conflicts found**:
- Present conflict report to user
- Ask for resolution preference:
  - **Sequence**: Execute conflicting agents one at a time
  - **Reassign**: Move conflicting files to single agent
  - **Manual**: User provides custom resolution
- Update plans based on resolution
- Re-run conflict detection to confirm resolution

**If no conflicts**:
- Proceed to Phase 4

---

## Phase 4: File Claiming

**Goal**: Register file ownership before implementation begins

**Actions**:
1. For each approved plan, register file claims in `.claude/file-claims.md`:
```markdown
| agent-1 | src/api/handler.ts | 2025-01-15T10:30:00Z | claimed |
| agent-1 | src/utils/auth.ts | 2025-01-15T10:30:00Z | claimed |
| agent-2 | src/db/queries.ts | 2025-01-15T10:30:00Z | claimed |
```

2. Determine execution order based on conflict analysis:
   - **Parallel batch 1**: Agents with no conflicts or dependencies
   - **Sequential queue**: Agents that must wait for others

3. Update swarm status:
```json
{
  "phase": "implementing",
  "execution_order": [
    {"batch": 1, "agents": ["agent-1", "agent-2"], "parallel": true},
    {"batch": 2, "agents": ["agent-3"], "parallel": false, "waits_for": ["agent-1"]}
  ]
}
```

---

## Phase 5: Implementation with Monitoring

**Goal**: Execute implementation with proactive status monitoring

**Actions**:
1. Launch first batch of implementation agents

2. **Status Polling Loop** (every 30-60 seconds during execution):
   - Launch a **status-checker** agent (haiku model for speed)
   - Review status report
   - If issues detected:
     - **Conflict**: Pause later agent, let first complete
     - **Stuck agent**: Check logs, consider reassignment
     - **Failed agent**: Report to user, decide whether to retry or skip

3. As each agent completes:
   - Update swarm status: `"status": "completed"`
   - Release file claims in `.claude/file-claims.md`: change status to `released`
   - Launch next queued agents that were waiting

4. **Agent Instructions** (include in each implementation agent's prompt):
```markdown
## Coordination Requirements

Before editing any file:
1. Read `.claude/file-claims.md`
2. Verify the file is claimed by YOU (your agent ID)
3. If claimed by another agent, SKIP and note in your results
4. If not claimed, DO NOT edit - report the missing claim

After completing work:
1. Update your status in swarm communication
2. Report files modified for claim release

If you encounter a conflict:
1. STOP editing the conflicted file
2. Report the conflict immediately
3. Wait for orchestrator resolution
```

---

## Phase 6: Verification

**Goal**: Verify swarm completed successfully

**Actions**:
1. Check all agents completed:
   - Read final swarm status
   - Verify all planned files were modified
   - Check for any orphaned claims

2. Run integration checks:
   - Build/compile if applicable
   - Run tests if applicable
   - Check for import/type errors

3. Clean up coordination files:
   - Archive swarm status to `.claude/swarm-history/`
   - Clear file claims
   - Remove plan files

---

## Phase 7: Summary

**Goal**: Report swarm execution results

**Actions**:
1. Summarize:
   - Total agents launched
   - Files modified/created/deleted
   - Conflicts detected and resolved
   - Issues encountered
   - Total execution time

2. Present to user:
   - What was accomplished
   - Any items requiring follow-up
   - Suggested next steps

---

## Error Handling

**Agent Failure**:
1. Log failure in swarm status
2. Release failed agent's file claims
3. Ask user: retry, skip, or abort swarm

**Unresolvable Conflict**:
1. Pause all conflicting agents
2. Present options to user
3. Wait for manual resolution

**Stuck Swarm**:
1. If no progress for 5+ minutes, alert user
2. Provide diagnostic information
3. Offer to abort and roll back

---

## File Claim Convention (For All Agents)

Include this instruction block in every implementation agent's system prompt:

```markdown
## File Claiming Protocol

You are part of a coordinated swarm. Follow these rules strictly:

1. **Before ANY file edit**:
   - Read `.claude/file-claims.md`
   - Find your agent ID in the registry
   - Only edit files claimed by YOUR agent ID

2. **If file is claimed by another agent**:
   - DO NOT edit the file
   - Note in your results: "Skipped [file] - claimed by [other-agent]"
   - Continue with other work

3. **If file is not in claims registry**:
   - DO NOT edit the file
   - Report: "Cannot edit [file] - not in approved claims"
   - This indicates a planning oversight

4. **Update your progress**:
   - After each significant step, your status will be tracked
   - If you encounter issues, report them clearly
```

---

## Status Polling Schedule

During Phase 5, launch status-checker agent:
- After initial batch launch: wait 30 seconds, then check
- During active execution: check every 45-60 seconds
- After agent completion: immediate check to launch next batch
- On any reported issue: immediate check

Use **haiku model** for status-checker to minimize latency and cost.
