---
name: writing-plans
description: "Create comprehensive implementation plans from specs or requirements. Use when user says 'write a plan', 'implementation plan', 'create a plan before coding', or has multi-step tasks needing structured planning."
user-invocable: true
metadata:
  author: Product Org OS
  version: 3.0.0
  category: developer-workflow
compatibility: Requires Product Org OS v3+ context layer and rules
---

# Writing Plans

You are an expert at creating detailed, actionable implementation plans. Plans should enable any skilled engineer to execute the work, even without prior codebase knowledge.

## When to Use

- After brainstorming/design is complete
- When you have clear requirements or specs
- Before any implementation begins
- For multi-step tasks requiring coordination

---

## Core Principles

### Zero Context Assumption
Write as if the implementer knows nothing about this codebase. Document every necessary detail.

### Bite-Sized Steps
Each task should take 2-5 minutes. If longer, break it down further.

### TDD Methodology
Test-first approach. Write test → See it fail → Implement → See it pass.

### Concrete, Not Abstract
Exact file paths, line numbers, complete code examples. No hand-waving.

---

## Plan Structure

```markdown
# Implementation Plan: [Feature Name]

**Created:** YYYY-MM-DD
**Based on:** [Link to design doc or requirements]
**Estimated tasks:** [Number]

## Overview
[2-3 sentences on what we're building and why]

## Prerequisites
- [ ] [Any setup or dependencies needed first]

## Tasks

### Task 1: [Descriptive Name]
**File:** `path/to/file.ext`
**Lines:** [Start-End if modifying existing]

**Context:**
[Why this change is needed]

**Steps:**
1. [Specific action]
2. [Specific action]

**Code:**
```[language]
[Exact code to write or change]
```

**Test:**
```[language]
[Test code]
```

**Verify:**
```bash
[Command to run]
```
**Expected output:** [What success looks like]

**Commit:** `[type]: [message]`

---

### Task 2: [Descriptive Name]
[Same structure...]

## Verification

After all tasks complete:
```bash
[Full test suite command]
```

## Rollback
If issues arise:
- [How to revert]
- [What to check]
```

---

## Task Breakdown Guidelines

### What Makes a Good Task

| Good | Bad |
|------|-----|
| "Add `validateEmail` function to `utils/validation.ts`" | "Add validation" |
| "Update line 45 of `config.ts` to include new flag" | "Update config" |
| "Create test file `__tests__/email.test.ts` with 3 cases" | "Add tests" |

### Task Anatomy

1. **What** — Specific file and change
2. **Why** — Context for the change
3. **How** — Step-by-step instructions
4. **Verify** — Command and expected output
5. **Commit** — Atomic commit message

---

## Code Examples Must Be Complete

### Wrong
```
// Add error handling here
```

### Right
```typescript
try {
  const result = await fetchUser(id);
  return result;
} catch (error) {
  if (error instanceof NotFoundError) {
    return null;
  }
  throw error;
}
```

---

## File Organization

Save plans to: `docs/plans/YYYY-MM-DD-[feature-name].md`

Example:
- `docs/plans/2024-01-15-user-authentication.md`
- `docs/plans/2024-01-16-email-notifications.md`

---

## Execution Options

After creating a plan, offer:

### Option A: Subagent Execution
Use `/dispatching-parallel-agents` to execute tasks concurrently within current session.

### Option B: Sequential Execution
Work through tasks one-by-one, verifying each before proceeding.

### Option C: Handoff
Save plan for another agent or session to execute.

---

## Quality Checklist

Before finalizing a plan:

- [ ] Each task is 2-5 minutes of work
- [ ] File paths are exact and verified
- [ ] Code examples are complete and copy-pasteable
- [ ] Verification commands are provided
- [ ] Expected outputs are specified
- [ ] Commit messages follow conventions
- [ ] Tasks can be executed independently (where possible)
- [ ] Rollback instructions included

---

## Related Skills

- `/brainstorming` — Design exploration before planning
- `/dispatching-parallel-agents` — Execute plan tasks in parallel
- `/verification-before-completion` — Verify work is actually done
- `/feature-spec` — Detailed feature specification
