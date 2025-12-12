# Simple Swarm Example

A two-agent swarm implementing a feature with coordinated file claiming.

## Scenario

Task: Add user authentication to an Express API

## Initial Setup

### Swarm Status File
`.claude/swarm-status.json`:
```json
{
  "swarm_id": "auth-feature-001",
  "task": "Add user authentication",
  "started": "2025-01-15T10:00:00Z",
  "phase": "initialized",
  "agents": {}
}
```

### File Claims Registry
`.claude/file-claims.md`:
```markdown
# File Claims Registry

Last updated: 2025-01-15T10:00:00Z
Swarm ID: auth-feature-001

| Agent ID | File Path | Claimed At | Status |
|----------|-----------|------------|--------|
```

## Phase 1: Planning

Launch two planning agents:

**Agent 1 Prompt**:
```
Analyze the codebase and create an implementation plan for:
Adding JWT token validation middleware

You are in PLANNING MODE - DO NOT modify any files.
Output a structured plan with all files you need to modify.
```

**Agent 2 Prompt**:
```
Analyze the codebase and create an implementation plan for:
Adding user login/logout API endpoints

You are in PLANNING MODE - DO NOT modify any files.
Output a structured plan with all files you need to modify.
```

### Agent 1 Plan Output
`.claude/swarm-plans/jwt-middleware.md`:
```markdown
## Agent Plan: jwt-middleware

### Task Summary
Implement JWT token validation middleware for protected routes.

### Files to Modify
- `src/middleware/index.ts`: Export new auth middleware

### Files to Create
- `src/middleware/auth.ts`: JWT validation middleware
- `src/types/auth.ts`: Token payload types

### Dependencies
- Requires: None
- Blocks: Protected routes need this middleware

### Implementation Steps
1. Create auth types
2. Implement JWT validation middleware
3. Export from middleware index
```

### Agent 2 Plan Output
`.claude/swarm-plans/auth-endpoints.md`:
```markdown
## Agent Plan: auth-endpoints

### Task Summary
Implement login and logout API endpoints.

### Files to Modify
- `src/routes/index.ts`: Add auth routes
- `src/middleware/index.ts`: Import auth utilities

### Files to Create
- `src/routes/auth.ts`: Login/logout endpoints
- `src/services/auth.ts`: Authentication service

### Dependencies
- Requires: JWT middleware for logout validation
- Blocks: None

### Implementation Steps
1. Create auth service
2. Implement auth routes
3. Update routes index
4. Update middleware index
```

## Phase 2: Conflict Detection

Analyzing plans:

```
File: src/middleware/index.ts
  - jwt-middleware: modify (export new middleware)
  - auth-endpoints: modify (import auth utilities)
  → CONFLICT DETECTED
```

### Conflict Report
```markdown
## Conflict Analysis

### Conflicts Found: 1

#### Conflict 1: src/middleware/index.ts
Agents: jwt-middleware, auth-endpoints
Nature: Both agents plan to modify this file
- jwt-middleware: Add export for auth middleware
- auth-endpoints: Import auth utilities

**Resolution Options**:
1. Sequential: jwt-middleware first, then auth-endpoints
2. Merge: Have jwt-middleware handle all middleware/index.ts changes
```

## Phase 3: Resolution

**Chosen Resolution**: Option 1 - Sequential execution

Updated execution plan:
- Batch 1: jwt-middleware (no dependencies)
- Batch 2: auth-endpoints (after jwt-middleware completes)

## Phase 4: File Claiming

Updated `.claude/file-claims.md`:
```markdown
# File Claims Registry

Last updated: 2025-01-15T10:05:00Z
Swarm ID: auth-feature-001

| Agent ID | File Path | Claimed At | Status |
|----------|-----------|------------|--------|
| jwt-middleware | src/middleware/auth.ts | 2025-01-15T10:05:00Z | claimed |
| jwt-middleware | src/middleware/index.ts | 2025-01-15T10:05:00Z | claimed |
| jwt-middleware | src/types/auth.ts | 2025-01-15T10:05:00Z | claimed |
| auth-endpoints | src/routes/auth.ts | 2025-01-15T10:05:00Z | pending |
| auth-endpoints | src/routes/index.ts | 2025-01-15T10:05:00Z | pending |
| auth-endpoints | src/services/auth.ts | 2025-01-15T10:05:00Z | pending |
```

Note: auth-endpoints claims are "pending" until jwt-middleware completes.

## Phase 5: Implementation

### Batch 1: jwt-middleware

Launch jwt-middleware agent with implementation instructions:
```
Execute your approved plan from .claude/swarm-plans/jwt-middleware.md
Only modify files claimed by jwt-middleware in .claude/file-claims.md
```

**Status after 45 seconds** (from status-checker):
```json
{
  "overall_health": "healthy",
  "agents": {
    "jwt-middleware": {"status": "working", "progress": "Creating middleware"}
  }
}
```

**Status after 2 minutes**:
```json
{
  "overall_health": "healthy",
  "agents": {
    "jwt-middleware": {"status": "completed"}
  }
}
```

### Release Claims & Activate Batch 2

Updated `.claude/file-claims.md`:
```markdown
| jwt-middleware | src/middleware/auth.ts | 2025-01-15T10:05:00Z | released |
| jwt-middleware | src/middleware/index.ts | 2025-01-15T10:05:00Z | released |
| jwt-middleware | src/types/auth.ts | 2025-01-15T10:05:00Z | released |
| auth-endpoints | src/routes/auth.ts | 2025-01-15T10:07:00Z | claimed |
| auth-endpoints | src/routes/index.ts | 2025-01-15T10:07:00Z | claimed |
| auth-endpoints | src/services/auth.ts | 2025-01-15T10:07:00Z | claimed |
| auth-endpoints | src/middleware/index.ts | 2025-01-15T10:07:00Z | claimed |
```

Note: auth-endpoints now also claims middleware/index.ts after jwt-middleware released it.

### Batch 2: auth-endpoints

Launch auth-endpoints agent with implementation instructions.

**Status after 3 minutes**:
```json
{
  "overall_health": "healthy",
  "agents": {
    "jwt-middleware": {"status": "completed"},
    "auth-endpoints": {"status": "completed"}
  },
  "completion_percentage": 100
}
```

## Phase 6: Verification

Checks:
- [x] jwt-middleware completed
- [x] auth-endpoints completed
- [x] All files modified as planned
- [x] No orphaned claims
- [x] Build succeeds
- [x] Tests pass

## Phase 7: Summary

```markdown
## Swarm Completion Report

### Task: Add user authentication
### Duration: 8 minutes
### Agents: 2

### Files Created
- src/middleware/auth.ts
- src/types/auth.ts
- src/routes/auth.ts
- src/services/auth.ts

### Files Modified
- src/middleware/index.ts
- src/routes/index.ts

### Conflicts Resolved
- 1 conflict on src/middleware/index.ts (sequential resolution)

### Status: SUCCESS
```
