---
name: agent-patterns
description: This skill should be used when the user asks about "SPAWN REQUEST format", "agent reports", "agent coordination", "parallel agents", "report format", "agent communication", or needs to understand how agents coordinate within the sprint system.
version: 1.0.0
author: Damien Laine <damien.laine@gmail.com>
license: MIT
allowed-tools:
  - Read
---

# Agent Patterns

Sprint coordinates multiple specialized agents through structured communication patterns. This skill covers the SPAWN REQUEST format, report structure, parallel execution, and inter-agent coordination.

## Agent Hierarchy

```
┌─────────────────────────────────────┐
│         Sprint Orchestrator         │
│    (parses requests, spawns agents) │
└─────────────────┬───────────────────┘
                  │
                  ▼
┌─────────────────────────────────────┐
│        Project Architect            │
│  (plans, creates specs, coordinates)│
└─────────────────┬───────────────────┘
                  │ SPAWN REQUEST
                  ▼
┌─────────────────────────────────────┐
│      Implementation & Test Agents   │
│   (execute, report, never spawn)    │
└─────────────────────────────────────┘
```

**Key rule**: Only the orchestrator spawns agents. Agents communicate by returning structured messages.

## SPAWN REQUEST Format

The architect requests agent spawning using a specific format:

```markdown
## SPAWN REQUEST

- python-dev
- nextjs-dev
- cicd-agent
```

### Parsing Rules

The orchestrator parses SPAWN REQUEST blocks:
- Section must start with `## SPAWN REQUEST` on its own line
- Each agent listed as a bullet point
- Multiple agents spawn in parallel

### Implementation Agents

Request during Phase 2:
```markdown
## SPAWN REQUEST

- python-dev
- nextjs-dev
```

Never include test agents in implementation requests.

### Testing Agents

Request during Phase 3:
```markdown
## SPAWN REQUEST

- qa-test-agent
- ui-test-agent
```

The ui-test-agent runs in AUTOMATED or MANUAL mode based on `specs.md`:
- `UI Testing Mode: automated` (default) → runs test scenarios automatically
- `UI Testing Mode: manual` → opens browser for user to test, waits for tab close

## Agent Report Format

All agents return structured reports. The orchestrator saves these as files.

### Standard Report Sections

Every report includes:

| Section | Purpose |
|---------|---------|
| CONFORMITY STATUS | YES/NO - did agent follow specs? |
| SUMMARY | Brief outcome description |
| DEVIATIONS | Justified departures from specs |
| FILES CHANGED | List of modified files |
| ISSUES | Problems encountered |
| NOTES FOR ARCHITECT | Suggestions, observations |

### Example: Backend Report

```markdown
## BACKEND REPORT

### CONFORMITY STATUS: YES

### SUMMARY
Implemented user authentication endpoints per api-contract.md.

### FILES CHANGED
- backend/app/routers/auth.py (new)
- backend/app/models/user.py (modified)
- backend/app/schemas/auth.py (new)
- backend/alembic/versions/001_add_users.py (new)

### DEVIATIONS
None.

### ISSUES
None.

### NOTES FOR ARCHITECT
- Consider adding rate limiting middleware in next sprint
- Password hashing uses bcrypt (industry standard)
```

### Example: QA Report

```markdown
## QA REPORT

### SUITE STATUS
- New test files: 2
- Updated test files: 1
- Test framework(s): pytest
- Test command(s): pytest tests/api/

### API CONFORMITY STATUS: YES

### SUMMARY
- Total endpoints in contract: 5
- Endpoints covered by automated tests: 5
- Endpoints with failing tests: 0

### FAILURES AND DEVIATIONS
None.

### TEST EXECUTION
- Tests run: YES
- Result: ALL PASS
- Notes: 23 tests passed in 1.4s

### NOTES FOR ARCHITECT
- Added edge case tests for password validation
```

### Example: UI Test Report

```markdown
## UI TEST REPORT

### MODE
AUTOMATED

### SUMMARY
- Total tests run: 8
- Passed: 7
- Failed: 1
- Session duration: 45s

### COVERAGE
- Scenarios covered:
  - Login with valid credentials
  - Login with invalid password
  - Registration flow
  - Password reset request
- Not covered (yet):
  - Email verification flow (requires email testing setup)

### FAILURES
- Scenario: Registration validation
  - Path/URL: /register
  - Symptom: Error message not displayed
  - Expected: "Email already exists" message
  - Actual: Form submits without feedback

### CONSOLE ERRORS
None.

### NOTES FOR ARCHITECT
- Registration error handling needs frontend fix
```

## Parallel Execution

### Implementation Agents

Spawn all implementation agents simultaneously:

```
Task: python-dev     ─────────▶ Backend Report
Task: nextjs-dev     ─────────▶ Frontend Report
Task: cicd-agent     ─────────▶ CICD Report
```

Use a single message with multiple Task tool calls.

### Testing Agents

QA runs first, then UI tests:

```
Task: qa-test-agent  ─────────▶ QA Report
                                    │
                                    ▼
Task: ui-test-agent  ─────────▶ UI Test Report
Task: diagnostics    ─────────▶ Diagnostics Report
     (parallel with ui-test)
```

UI test and diagnostics agents run in parallel with each other.

## Agent Constraints

### What Agents Can Do

- Read specification files
- Read project-map.md (read-only)
- Implement code in their domain
- Run tests in their domain
- Return structured reports

### What Agents Cannot Do

- Spawn other agents
- Modify `status.md` (architect only)
- Modify `project-map.md` (architect only)
- Create methodology documentation
- Push to git repositories

## File-Based Coordination

When agents need to coordinate beyond reports:

### Report Files

Orchestrator saves reports as:
```
.claude/sprint/[N]/[slug]-report-[iteration].md
```

Slugs:
- `python-dev` → `backend`
- `nextjs-dev` → `frontend`
- `qa-test-agent` → `qa`
- `ui-test-agent` → `ui-test`

## Specialized Agent Roles

### Project Architect

The decision-maker:
- Creates specification files
- Maintains project-map.md and status.md
- Analyzes agent reports
- Decides next steps (implement, test, finalize)

### Implementation Agents

Technology-specific builders:
- `python-dev`: Python/FastAPI backend
- `nextjs-dev`: Next.js frontend
- `cicd-agent`: CI/CD pipelines
- `allpurpose-agent`: Any other technology

### Testing Agents

Quality validators:
- `qa-test-agent`: API and unit tests
- `ui-test-agent`: Browser-based E2E tests
- Framework-specific diagnostics agents

## FINALIZE Signal

The architect signals sprint completion:

```markdown
FINALIZE
Phase 5 complete. Sprint [N] is finalized.
```

The orchestrator detects this and exits the iteration loop.

## Best Practices

### Report Quality

- Keep reports concise
- Focus on actionable information
- No verbose logs or stack traces
- Summarize, don't dump

### Parallel Efficiency

- Spawn independent agents together
- Don't wait unnecessarily

### Spec Adherence

- Always read specs before implementing
- Report deviations with justification
- Follow API contracts exactly

## Additional Resources

For detailed agent definitions and report formats, see the agent files in the plugin's `agents/` directory.
