# Checkpoint-Based Orchestration

A phased approach to swarm execution that prevents conflicts through planning, review, and controlled implementation.

## Overview

Checkpoint-based orchestration separates swarm execution into distinct phases:

1. **Planning** - Agents analyze and plan (read-only)
2. **Review** - Orchestrator detects conflicts
3. **Resolution** - Conflicts resolved before implementation
4. **Claiming** - Files assigned to agents
5. **Implementation** - Agents execute plans
6. **Verification** - Results validated

## Why Checkpoints?

### Without Checkpoints
```
Launch agents → Agents work in parallel → CONFLICT! →
Agents overwrite each other → Endless fix loops → Chaos
```

### With Checkpoints
```
Launch planning agents → Collect plans → Detect conflicts →
Resolve conflicts → Claim files → Sequential/parallel execution → Success
```

## Phase Details

### Phase 1: Planning (Parallel, Read-Only)

**Purpose**: Gather implementation plans without making changes

**Key Rules**:
- Agents may READ any file
- Agents must NOT WRITE any file
- Each agent produces a structured plan

**Agent Instructions**:
```markdown
You are in PLANNING MODE. Analyze the codebase and create an implementation plan.

CRITICAL RESTRICTIONS:
- DO NOT use Edit, Write, or any file modification tools
- DO NOT execute commands that modify files
- ONLY use Read, Glob, Grep for analysis

Your output must be a structured plan listing:
- All files you need to modify (with full paths)
- All files you need to create
- All files you need to delete
- Dependencies on other components
- Step-by-step implementation approach
```

**Plan Format**:
```markdown
## Agent Plan: [agent-id]

### Task Summary
[1-2 sentence description of what this agent will accomplish]

### Files to Modify
- `src/auth/handler.ts`: Add validateToken() function and update handleRequest()
- `src/types/auth.ts`: Add TokenPayload interface

### Files to Create
- `src/auth/tokens.ts`: Token generation and validation utilities

### Files to Delete
- `src/auth/legacy-auth.ts`: Replaced by new implementation

### Dependencies
- **Requires**: Database schema must include users table
- **Blocks**: API routes cannot be updated until auth is complete

### Implementation Steps
1. Create TokenPayload interface in types
2. Implement token utilities in new file
3. Update handler with validation logic
4. Remove legacy file after verification

### Estimated Scope
- Files touched: 4
- Lines added: ~150
- Lines removed: ~80
- Risk level: Medium (touching auth system)
```

### Phase 2: Conflict Detection

**Purpose**: Identify overlapping file edits before they happen

**Process**:
1. Collect all agent plans
2. Build file → agent mapping
3. Identify conflicts:
   - Same file modified by multiple agents
   - Delete conflicts with modify
   - Creation conflicts
   - Dependency cycles

**Conflict Types**:

| Type | Severity | Example |
|------|----------|---------|
| Same file modify | Critical | agent-1 and agent-2 both modify handler.ts |
| Create collision | Critical | Both agents create utils/helper.ts |
| Delete + Modify | Critical | agent-1 deletes file agent-2 modifies |
| Dependency cycle | Critical | agent-1 waits for agent-2, agent-2 waits for agent-1 |
| Same directory | Warning | Both agents add files to src/utils/ |
| Import chain | Info | agent-1's file imports from agent-2's file |

### Phase 3: Resolution

**Purpose**: Resolve all conflicts before implementation begins

**Resolution Strategies**:

**Sequential Execution**:
```markdown
Conflict: agent-1 and agent-2 both modify src/api/index.ts

Resolution: Execute sequentially
- Execution order: agent-1 first, then agent-2
- agent-2 will see agent-1's changes before starting
```

**Scope Reassignment**:
```markdown
Conflict: agent-1 (auth) and agent-2 (logging) both modify middleware.ts

Resolution: Reassign to single agent
- Expand agent-1's scope to include logging changes
- Remove middleware.ts from agent-2's plan
```

**File Splitting**:
```markdown
Conflict: agent-1 and agent-2 both modify large config.ts

Resolution: Split the file
- Create config/auth.ts (agent-1)
- Create config/db.ts (agent-2)
- Update config/index.ts to re-export
```

**User Decision**:
```markdown
Conflict: Complex dependency between agent-1 and agent-3

Resolution: Present to user
"Agents 1 and 3 have interleaved dependencies. Options:
1. Merge into single agent
2. Manual sequencing with intermediate reviews
3. Redesign the task split"
```

### Phase 4: File Claiming

**Purpose**: Register file ownership before implementation

**Process**:
1. For each resolved plan, register claims
2. Update `.claude/file-claims.md`
3. Determine execution batches

**Execution Order Determination**:
```markdown
Given resolved plans:
- agent-1: No dependencies
- agent-2: No dependencies
- agent-3: Depends on agent-1
- agent-4: Depends on agent-2 and agent-3

Execution order:
Batch 1 (parallel): agent-1, agent-2
Batch 2 (after batch 1): agent-3
Batch 3 (after agent-3): agent-4
```

### Phase 5: Implementation with Monitoring

**Purpose**: Execute plans with status tracking

**Process**:
1. Launch batch 1 agents
2. Start polling loop (every 30-60 seconds)
3. As agents complete:
   - Release their file claims
   - Launch dependent agents
4. Handle issues as detected:
   - Stuck agents → investigate/reassign
   - Conflicts → pause and resolve
   - Failures → report and decide

**Agent Instructions for Implementation**:
```markdown
You are now in IMPLEMENTATION MODE. Execute your approved plan.

Your approved plan is in: .claude/swarm-plans/[your-agent-id].md
Your claimed files are in: .claude/file-claims.md

RULES:
1. Only modify files that are claimed by YOUR agent ID
2. Follow your plan exactly - do not expand scope
3. If you need to modify an unclaimed file, STOP and report
4. Update progress by completing your assigned tasks
```

### Phase 6: Verification

**Purpose**: Validate swarm completed successfully

**Checks**:
- [ ] All agents reported completion
- [ ] All planned files were modified
- [ ] No orphaned file claims
- [ ] Build succeeds (if applicable)
- [ ] Tests pass (if applicable)
- [ ] No unexpected files modified

## Checkpoint Gates

Each phase has a gate that must pass before proceeding:

| Gate | Condition | Failure Action |
|------|-----------|----------------|
| Planning → Review | All planning agents completed | Wait or timeout |
| Review → Resolution | Conflict report generated | Re-run detection |
| Resolution → Claiming | All conflicts resolved | Return to resolution |
| Claiming → Implementation | All files claimed, no overlaps | Fix claim issues |
| Implementation → Verification | All agents completed | Investigate failures |
| Verification → Complete | All checks pass | Fix issues or report |

## State Machine

```
┌─────────────┐
│ INITIALIZED │
└──────┬──────┘
       │ Start swarm
       ▼
┌─────────────┐
│  PLANNING   │◄────────────────┐
└──────┬──────┘                 │
       │ All plans received     │
       ▼                        │
┌─────────────┐                 │
│  REVIEWING  │                 │
└──────┬──────┘                 │
       │ Conflicts identified   │
       ▼                        │
┌─────────────┐                 │
│  RESOLVING  │─────────────────┘
└──────┬──────┘  Need re-plan
       │ All resolved
       ▼
┌─────────────┐
│  CLAIMING   │
└──────┬──────┘
       │ Files assigned
       ▼
┌─────────────┐
│IMPLEMENTING │◄───┐
└──────┬──────┘    │
       │           │ Next batch
       ▼           │
┌─────────────┐    │
│  VERIFYING  │────┘
└──────┬──────┘  More batches
       │ All verified
       ▼
┌─────────────┐
│  COMPLETED  │
└─────────────┘
```

## Benefits

1. **No Conflicts**: Detected and resolved before implementation
2. **Visibility**: Know exactly what each agent will do
3. **Control**: Orchestrator maintains full oversight
4. **Recovery**: Can roll back or adjust between phases
5. **Efficiency**: Parallel execution where safe, sequential where needed
