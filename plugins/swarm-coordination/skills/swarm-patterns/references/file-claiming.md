# File Claiming Convention

A coordination protocol where agents claim file ownership before editing to prevent conflicts.

## Overview

File claiming is a simple but effective convention:
1. Before editing any file, agent checks if it's claimed
2. If unclaimed or claimed by self, proceed
3. If claimed by another agent, skip and report
4. After completion, release claims

## The Claims Registry

Location: `.claude/file-claims.md`

### Format

```markdown
# File Claims Registry

Last updated: 2025-01-15T10:30:00Z
Swarm ID: swarm-20250115-abc123

| Agent ID | File Path | Claimed At | Status |
|----------|-----------|------------|--------|
| auth-impl | src/auth/handler.ts | 2025-01-15T10:00:00Z | claimed |
| auth-impl | src/auth/types.ts | 2025-01-15T10:00:00Z | claimed |
| auth-impl | src/auth/middleware.ts | 2025-01-15T10:00:00Z | claimed |
| db-agent | src/db/schema.ts | 2025-01-15T10:00:00Z | released |
| db-agent | src/db/queries.ts | 2025-01-15T10:00:00Z | released |
```

### Status Values

| Status | Meaning |
|--------|---------|
| `claimed` | Agent is actively working on this file |
| `released` | Agent completed, file available |
| `conflict` | Multiple agents claimed (needs resolution) |

## Agent Instructions

Include this block in every implementation agent's system prompt:

```markdown
## File Claiming Protocol

You are part of a coordinated swarm. Follow these rules strictly:

### Before ANY File Edit

1. Read `.claude/file-claims.md`
2. Find the file you want to edit in the registry
3. Check the claim status:

**If claimed by YOUR agent ID** → Proceed with edit
**If claimed by ANOTHER agent** → DO NOT edit, report:
   "Skipped [file] - claimed by [other-agent]"
**If file NOT in registry** → DO NOT edit, report:
   "Cannot edit [file] - not in approved claims"

### During Execution

- Only edit files explicitly claimed by you
- If you discover a need to edit an unclaimed file, report it
- Do not modify the claims registry yourself

### After Completion

Report all files you modified so claims can be released.
```

## Claim Lifecycle

```
┌─────────────────────────────────────────────────────────┐
│                    PLANNING PHASE                        │
│  Agent creates plan → Lists files to modify              │
└────────────────────────┬────────────────────────────────┘
                         │
                         ▼
┌─────────────────────────────────────────────────────────┐
│                  CONFLICT DETECTION                      │
│  Orchestrator reviews all plans → Identifies overlaps   │
│  Resolves conflicts → Determines execution order         │
└────────────────────────┬────────────────────────────────┘
                         │
                         ▼
┌─────────────────────────────────────────────────────────┐
│                    CLAIM REGISTRATION                    │
│  Orchestrator writes claims to registry                  │
│  Each file → exactly one agent                          │
└────────────────────────┬────────────────────────────────┘
                         │
                         ▼
┌─────────────────────────────────────────────────────────┐
│                    IMPLEMENTATION                        │
│  Agents check registry before each edit                  │
│  Only edit files claimed by self                        │
└────────────────────────┬────────────────────────────────┘
                         │
                         ▼
┌─────────────────────────────────────────────────────────┐
│                    CLAIM RELEASE                         │
│  Agent completes → Reports to orchestrator              │
│  Orchestrator marks claims as "released"                │
└─────────────────────────────────────────────────────────┘
```

## Conflict Resolution Strategies

When multiple agents need the same file:

### Strategy 1: Sequential Execution

```markdown
Conflict: agent-1 and agent-3 both need src/api/handler.ts

Resolution:
- agent-1 claims file, executes first
- After agent-1 completes, release claim
- agent-3 claims file, executes second
```

### Strategy 2: Scope Partition

```markdown
Conflict: agent-1 and agent-2 both need src/types/index.ts

Resolution:
- Split file into src/types/auth.ts and src/types/user.ts
- agent-1 claims auth.ts
- agent-2 claims user.ts
- Update index.ts to re-export (claimed by orchestrator)
```

### Strategy 3: Merge Responsibility

```markdown
Conflict: agent-1 (auth) and agent-2 (validation) both need middleware.ts

Resolution:
- Expand agent-1's scope to include validation changes
- Remove middleware.ts from agent-2's plan
- agent-1 handles all middleware changes
```

### Strategy 4: Section-Based Claims

```markdown
Conflict: Multiple agents need same config file

Resolution:
- Claim specific sections rather than whole file
- agent-1 claims: config.ts lines 1-50 (auth section)
- agent-2 claims: config.ts lines 51-100 (db section)
- Requires careful merge at end
```

## Handling Violations

### Agent Edits Unclaimed File

```markdown
Detected: agent-2 modified src/utils/helper.ts (not in claims)

Response:
1. Flag as violation in status report
2. Options:
   a. Add retroactive claim if no conflict
   b. Revert change if conflicts with another agent
   c. Pause agent and request clarification
```

### Agent Edits Another's File

```markdown
Detected: agent-2 modified src/auth/handler.ts (claimed by agent-1)

Response:
1. CRITICAL violation
2. Pause agent-2 immediately
3. Check if agent-1's work is corrupted
4. Options:
   a. Revert agent-2's changes
   b. Have agent-1 re-do affected work
   c. Manual merge by orchestrator
```

## Best Practices

1. **Register claims BEFORE launching agents** - Not during
2. **One file, one owner** - Never have overlapping claims
3. **Include all touched files** - Even read-heavy files if modified
4. **Release promptly** - Don't hold claims after completion
5. **Verify at completion** - Check all claimed files were handled
6. **Track unclaimed edits** - They indicate planning gaps

## Claims Registry Management

### Creating the Registry

```markdown
# File Claims Registry

Last updated: [timestamp]
Swarm ID: [swarm-id]

| Agent ID | File Path | Claimed At | Status |
|----------|-----------|------------|--------|
```

### Adding Claims (Orchestrator Only)

```markdown
| new-agent | src/new/file.ts | [timestamp] | claimed |
```

### Releasing Claims

Change status from `claimed` to `released`:

```markdown
| agent-id | src/file.ts | [timestamp] | released |
```

### Cleaning Up

After swarm completion:
1. Archive registry to `.claude/swarm-history/`
2. Delete or clear current registry
3. Ready for next swarm
