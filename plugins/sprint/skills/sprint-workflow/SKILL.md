---
name: sprint-workflow
description: This skill should be used when the user asks about "how sprints work", "sprint phases", "iteration workflow", "convergent development", "sprint lifecycle", "when to use sprints", or wants to understand the sprint execution model and its convergent diffusion approach.
version: 1.0.0
author: Damien Laine <damien.laine@gmail.com>
license: MIT
allowed-tools:
  - Read
---

# Sprint Workflow

Sprint implements a convergent development model where autonomous agents iteratively refine implementations until specifications are satisfied. This skill covers the execution lifecycle, phase transitions, and iteration patterns.

## Core Concept: Convergent Diffusion

Traditional AI-assisted development suffers from context bloat - each iteration adds more information, compounding errors and noise. Sprint reverses this pattern:

- **Start noisy**: Initial specs may be vague or incomplete
- **Converge iteratively**: Each iteration removes completed work from specs
- **Focus narrows**: Agents receive only remaining tasks, not history
- **Signal improves**: Less noise means better output quality

The metaphor is diffusion models in reverse - instead of adding noise to generate, remove noise to refine.

## Sprint Phases

A sprint executes through 6 distinct phases:

### Phase 0: Load Specifications

Parse the sprint directory and prepare context:
- Locate sprint directory (`.claude/sprint/[N]/`)
- Read `specs.md` for user requirements
- Read `status.md` if resuming
- Detect project type for framework-specific agents

### Phase 1: Architectural Planning

The project-architect agent analyzes requirements:
- Read existing `project-map.md` for architecture context
- Read `project-goals.md` for business objectives
- Create specification files (`api-contract.md`, `backend-specs.md`, etc.)
- Return SPAWN REQUEST for implementation agents

### Phase 2: Implementation

Spawn implementation agents in parallel:
- `python-dev` for Python/FastAPI backend
- `nextjs-dev` for Next.js frontend
- `cicd-agent` for CI/CD pipelines
- `allpurpose-agent` for any other technology
- Collect structured reports from each agent

### Phase 3: Testing

Execute testing agents:
- `qa-test-agent` runs first (API and unit tests)
- `ui-test-agent` runs after (browser-based E2E tests)
- Framework-specific diagnostics agents run in parallel with UI tests
- Collect test reports

### Phase 4: Review & Iteration

Architect reviews all reports:
- Analyze conformity status
- Update specifications (remove completed, add fixes)
- Update `status.md` with current state
- Decide: more implementation, more testing, or finalize

### Phase 5: Finalization

Sprint completion:
- Final `status.md` summary
- All specs in consistent state
- **Clean up manual-test-report.md** (no longer relevant)
- Signal FINALIZE to orchestrator

## Resuming Sprints

When running `/sprint` on an existing sprint:

**If status.md shows COMPLETE:**
- System asks: Run manual testing? Continue with fixes? Create new sprint?
- Guides user to appropriate action

**If status.md shows IN PROGRESS:**
- If manual-test-report.md exists: Uses it to inform architect
- If not: Offers to run manual testing first or continue

This ensures the user always knows where they are and what options they have.

## Iteration Loop

The sprint cycles between phases 1-4 until complete:

```
┌─────────────────────────────────────────┐
│                                         │
│  ┌──────────┐    ┌──────────────────┐  │
│  │ Phase 1  │───▶│ Phase 2          │  │
│  │ Planning │    │ Implementation   │  │
│  └──────────┘    └────────┬─────────┘  │
│       ▲                   │            │
│       │                   ▼            │
│  ┌────┴─────┐    ┌──────────────────┐  │
│  │ Phase 4  │◀───│ Phase 3          │  │
│  │ Review   │    │ Testing          │  │
│  └──────────┘    └──────────────────┘  │
│                                         │
└─────────────────────────────────────────┘
         │
         ▼ (after max 5 iterations or success)
    ┌──────────┐
    │ Phase 5  │
    │ Finalize │
    └──────────┘
```

**Maximum 5 iterations**: The system pauses after 5 cycles to prevent infinite loops. User intervention may be needed for complex blockers.

## When to Use Sprints

Sprints are ideal for:
- Multi-component features (backend + frontend + tests)
- Complex requirements needing architectural planning
- Tasks requiring coordination between specialized agents
- Incremental development with testing validation

Sprints are overkill for:
- Simple bug fixes (use direct implementation)
- Single-file changes
- Documentation-only updates
- Quick prototypes without testing needs

## Key Artifacts

### User-Created

| File | Purpose |
|------|---------|
| `specs.md` | Requirements, scope, testing config |
| `project-goals.md` | Business vision and objectives |

### Architect-Created

| File | Purpose |
|------|---------|
| `status.md` | Current sprint state (architect maintains) |
| `project-map.md` | Technical architecture (architect maintains) |
| `api-contract.md` | Shared interface between agents |
| `*-specs.md` | Agent-specific implementation guidance |

### Orchestrator-Created

| File | Purpose |
|------|---------|
| `*-report-[N].md` | Agent reports per iteration |

## Convergence Principles

### Specs Shrink Over Time

After each iteration, the architect:
- Removes completed tasks from spec files
- Removes outdated information
- Keeps only remaining work

This prevents context bloat and focuses agents on actual gaps.

### Status Stays Current

`status.md` is rewritten each iteration, not appended:
- Always reflects current truth
- Maximum ~50 lines
- No historical log dumps

### Reports Are Structured

Agents return machine-parseable reports:
- Standard sections (CONFORMITY, DEVIATIONS, ISSUES)
- No verbose prose
- Actionable information only

## Manual Testing

There are two ways to do manual testing:

### Within a Sprint (specs-driven)

Set `UI Testing Mode: manual` in your specs.md:
```markdown
## Testing
- UI Testing: required
- UI Testing Mode: manual
```

When the architect requests UI testing:
1. Browser opens pointing to your app
2. You explore the app manually
3. Console errors are monitored in the background
4. **Close the browser tab** when done testing
5. Agent detects tab close and returns report
6. Sprint continues with architect review

### Standalone Testing (quick access)

Use `/sprint:test` for quick testing outside of sprints:
- Opens Chrome browser directly
- Monitors errors while you explore
- Say "finish testing" when done
- **Report saved to `.claude/sprint/[N]/manual-test-report.md`**

**Reports feed into sprints:** When you run `/sprint`, the architect reads your manual test report and prioritizes fixing the issues you discovered.

Use manual testing for:
- Exploratory testing before a sprint
- Bug hunting and discovery
- UX validation
- Edge cases hard to automate

## Additional Resources

For more details, see the full command and agent documentation in the plugin's `commands/` and `agents/` directories.
