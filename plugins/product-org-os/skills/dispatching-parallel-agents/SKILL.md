---
name: dispatching-parallel-agents
description: Use when facing 2+ independent tasks that can be worked on without shared state or sequential dependencies. Deploys multiple agents simultaneously for parallel execution.
---

# Dispatching Parallel Agents

Use this skill when you have multiple independent tasks that can be solved concurrently rather than sequentially.

## When to Use

- Multiple test failures with different root causes
- Separate subsystems broken independently
- Problems that don't require understanding shared system context
- Tasks that won't interfere with each other

## When NOT to Use

- Failures are related or have common root cause
- Full system understanding is required
- Exploratory debugging (don't know what's wrong yet)
- Agents would modify shared resources

---

## The Pattern

### Step 1: Analyze & Group

Categorize problems into independent domains:

```markdown
## Problem Analysis

### Domain A: [Name]
- Task: [Specific scope]
- Files: [Affected files]
- Independent because: [Why it won't conflict]

### Domain B: [Name]
- Task: [Specific scope]
- Files: [Affected files]
- Independent because: [Why it won't conflict]
```

### Step 2: Create Focused Tasks

Each agent needs:

| Element | Good | Bad |
|---------|------|-----|
| Scope | "Fix auth validation in `auth.ts`" | "Fix all tests" |
| Goal | "Make `test_login_flow` pass" | "Fix authentication" |
| Constraints | "Don't modify `session.ts`" | (no constraints) |
| Expected Output | "PR-ready code with passing test" | (vague) |

### Step 3: Dispatch Concurrently

```markdown
## Parallel Dispatch

### Agent 1: [Domain A]
**Task:** [Specific task description]
**Files:** [List of files to work on]
**Success criteria:** [How to verify]
**Constraints:** [What NOT to touch]

### Agent 2: [Domain B]
**Task:** [Specific task description]
**Files:** [List of files to work on]
**Success criteria:** [How to verify]
**Constraints:** [What NOT to touch]
```

### Step 4: Review & Integrate

When agents return:

1. **Verify no conflicts** — Check for overlapping changes
2. **Run full test suite** — Ensure combined changes work
3. **Merge carefully** — Handle any unexpected interactions

---

## Task Specification Template

```markdown
## Agent Task: [Name]

### Objective
[One sentence: what must be true when done]

### Scope
- Files to modify: [List]
- Files to NOT modify: [List]

### Context
[Minimum necessary background]

### Success Criteria
- [ ] [Specific verifiable outcome]
- [ ] [Specific verifiable outcome]

### Verification Command
```bash
[Command to prove success]
```
```

---

## Common Mistakes

### Too Broad
❌ "Fix the failing tests"
✅ "Fix `test_user_creation` in `tests/user.test.ts` — the mock is returning wrong type"

### Missing Context
❌ "Update the config"
✅ "Update `config/auth.ts` to include the new `SESSION_TIMEOUT` env var (default: 3600)"

### Unclear Constraints
❌ "Fix the API"
✅ "Fix the `/users` endpoint. Don't modify `/auth` endpoints — another agent is handling those."

### Vague Success
❌ "Make it work"
✅ "Running `npm test -- --grep 'user creation'` should show 3 passing tests"

---

## Integration Checklist

After all agents complete:

- [ ] All individual verifications passed
- [ ] No file conflicts between agents
- [ ] Full test suite passes
- [ ] No unexpected side effects
- [ ] Changes are logically coherent together

---

## Example: Three Parallel Agents

```markdown
## Dispatch: Fix Dashboard Module

### Agent 1: Chart Component
**Objective:** Fix rendering crash when data is empty
**Files:** `components/Chart.tsx`, `components/Chart.test.tsx`
**Don't touch:** Any other components
**Verify:** `npm test -- Chart` passes

### Agent 2: Data Fetching
**Objective:** Fix timeout on slow networks
**Files:** `services/dashboard.ts`, `services/dashboard.test.ts`
**Don't touch:** Components or UI code
**Verify:** `npm test -- dashboard.test` passes

### Agent 3: State Management
**Objective:** Fix stale state on navigation
**Files:** `store/dashboard.ts`, `store/dashboard.test.ts`
**Don't touch:** Services or components
**Verify:** `npm test -- store/dashboard` passes

---

### Integration
After all complete:
```bash
npm test -- --grep 'Dashboard'
```
Expected: All dashboard tests pass
```

---

## Related Skills

- `/writing-plans` — Create plans for each agent
- `/verification-before-completion` — Each agent must verify
- `/brainstorming` — Understand problem before dispatching
