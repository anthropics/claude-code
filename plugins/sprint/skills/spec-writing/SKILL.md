---
name: spec-writing
description: This skill should be used when the user asks about "writing specs", "specs.md format", "how to write specifications", "sprint requirements", "testing configuration", "scope definition", or needs guidance on creating effective sprint specifications for agentic development.
version: 1.0.0
author: Damien Laine <damien.laine@gmail.com>
license: MIT
allowed-tools:
  - Read
---

# Spec Writing

Specifications drive the entire sprint workflow. Well-written specs lead to focused implementations; vague specs cause wasted iterations. This skill covers writing effective `specs.md` files that guide autonomous agents toward successful outcomes.

## The specs.md File

Located at `.claude/sprint/[N]/specs.md`, this file is the primary input to the sprint system. It tells the architect what to build and how to test it.

## Essential Structure

A complete specs.md contains:

```markdown
# Sprint [N]: [Short Title]

## Goal
[1-2 sentences describing what success looks like]

## Scope

### In Scope
- [Feature or task 1]
- [Feature or task 2]

### Out of Scope
- [What NOT to do]

## Requirements
[Detailed requirements - can be minimal or extensive]

## Testing
- QA: required / optional / skip
- UI Testing: required / optional / skip
- UI Testing Mode: automated / manual
```

## Writing Effective Goals

The goal statement shapes the entire sprint. Make it outcome-focused:

**Good goals:**
- "Users can register, login, and reset passwords"
- "API returns paginated product listings with filters"
- "Dashboard displays real-time metrics from backend"

**Bad goals:**
- "Implement authentication" (too vague)
- "Fix the bug" (which bug?)
- "Make it better" (unmeasurable)

A good goal answers: "How will we know when we're done?"

## Defining Scope

### In Scope

List concrete deliverables:
- Features to implement
- Endpoints to create
- UI components to build
- Tests to write

Be specific. "Add user profile page" is better than "improve user experience".

### Out of Scope

Explicitly exclude work to prevent scope creep:
- Related features not in this sprint
- Refactoring not needed for the goal
- Nice-to-haves for future sprints

This prevents agents from over-engineering or adding unrequested features.

## Requirements Depth

Specs can range from minimal to detailed. The architect adapts accordingly.

### Minimal Spec (One-liner)

```markdown
# Sprint 5: Add dark mode toggle

## Goal
Users can switch between light and dark themes.

## Testing
- UI Testing: required
- UI Testing Mode: manual
```

Appropriate for: Simple features, trusted architect judgment, exploratory work.

### Detailed Spec

```markdown
# Sprint 12: User Authentication

## Goal
Complete authentication flow with email verification.

## Scope

### In Scope
- Registration with email/password
- Login with session management
- Password reset via email
- Email verification flow
- Protected route middleware

### Out of Scope
- OAuth providers (future sprint)
- Two-factor authentication
- Account deletion

## Requirements

### Registration
- Email must be unique
- Password minimum 8 characters
- Send verification email on signup
- Users cannot login until verified

### Login
- Return JWT token on success
- Rate limit: 5 attempts per minute
- Lock account after 10 failed attempts

### Password Reset
- Token expires after 1 hour
- Invalidate token after use
- Send confirmation email after reset

## API Endpoints

| Method | Route | Purpose |
|--------|-------|---------|
| POST | /auth/register | Create account |
| POST | /auth/login | Authenticate |
| POST | /auth/verify | Verify email |
| POST | /auth/reset-request | Request reset |
| POST | /auth/reset | Reset password |

## Testing
- QA: required
- UI Testing: required
- UI Testing Mode: automated
```

Appropriate for: Complex features, specific requirements, team handoffs.

## Testing Configuration

The Testing section controls which testing agents run.

### Options

| Setting | Values | Meaning |
|---------|--------|---------|
| QA | required / optional / skip | API and unit tests |
| UI Testing | required / optional / skip | Browser-based E2E tests |
| UI Testing Mode | automated / manual | Auto-run or user-driven |

### When to Use Each

**QA: required**
- New API endpoints
- Business logic changes
- Data validation rules

**QA: skip**
- Frontend-only changes
- Documentation updates
- Configuration changes

**UI Testing: required**
- User-facing features
- Form submissions
- Navigation flows

**UI Testing Mode: manual**
- Complex interactions
- Visual verification needed
- Exploratory testing

**UI Testing Mode: automated**
- Regression testing
- Standard CRUD flows
- Repeatable scenarios

## Common Patterns

### New Feature

```markdown
## Goal
[What the feature does]

## Scope
### In Scope
- Backend API
- Frontend UI
- Integration tests

## Testing
- QA: required
- UI Testing: required
- UI Testing Mode: automated
```

### Bug Fix

```markdown
## Goal
Fix [specific issue description]

## Root Cause
[If known, describe the cause]

## Expected Behavior
[What should happen]

## Testing
- QA: required  # Regression test
- UI Testing: optional
```

### Refactoring

```markdown
## Goal
Refactor [component] for [benefit]

## Constraints
- No behavior changes
- Maintain API compatibility
- All existing tests must pass

## Testing
- QA: required  # Verify no regressions
- UI Testing: skip
```

## Tips for Better Specs

### Be Specific, Not Prescriptive

Tell the architect WHAT to build, not HOW to build it:
- Good: "Users can filter products by category and price range"
- Bad: "Use a Redux slice with useSelector for filter state"

The architect chooses implementation details.

### Include Edge Cases

Mention important edge cases in requirements:
- Empty states
- Error conditions
- Boundary values
- Concurrent access

### Reference Existing Patterns

If the codebase has conventions, mention them:
- "Follow the existing auth middleware pattern"
- "Use the same validation approach as user endpoints"

### Keep It Maintainable

Specs should be readable by humans too:
- Use clear headings
- Keep bullet points short
- Include examples where helpful

## Iteration and Updates

Specs evolve during the sprint:

1. **Initial**: User writes complete specs.md
2. **Phase 1**: Architect may clarify or expand
3. **Each iteration**: Architect removes completed items
4. **Final**: Specs reflect only documented decisions

This convergent pattern keeps context focused.

## Additional Resources

The `/sprint:new` command creates specs.md templates interactively. See the command file for implementation details.
