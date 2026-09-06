---
name: test-writer
description: Auto-invoked when the user asks to write, add, or generate tests for code (e.g. "write tests for X", "add test coverage", "test this function"). Provides a systematic workflow for detecting the testing framework, analyzing coverage gaps, writing idiomatic tests, and verifying they pass. Use the /test-writer slash command to run the full interactive workflow.
---

# Test Writer Skill

When asked to write or add tests for any code, follow this systematic approach.

## Quick Reference

| Phase | Goal | Key Action |
|-------|------|------------|
| 1 | Detect environment | Find framework, naming convention, run command |
| 2 | Analyze coverage | Launch `coverage-analyzer` agent |
| 3 | Plan tests | List happy path / edge / error scenarios |
| 4 | Write tests | Framework-idiomatic, AAA structure |
| 5 | Run & fix | All tests must pass before returning |

## Phase 1: Detect the Testing Environment

Before writing a single line, understand the project's testing setup.

1. Search for config files: `jest.config.*`, `vitest.config.*`, `pytest.ini`, `pyproject.toml`, `go.mod`, `.mocharc.*`
2. Check `package.json` scripts for the test command (`npm test`, `vitest`, `jest`, etc.)
3. Find 2-3 existing test files and read them to internalize:
   - File naming: `*.test.ts`, `*.spec.py`, `_test.go`, etc.
   - Assertion style: `expect().toBe()`, `assert`, `should`
   - Mock pattern: `vi.mock`, `jest.mock`, `unittest.mock`, `testify/mock`
   - Describe/it nesting depth

## Phase 2: Understand the Code Under Test

1. Read the target file(s) in full.
2. Launch the `coverage-analyzer` agent with the file path. It will:
   - Map all exported functions, classes, and branches
   - Find existing test files and identify already-covered paths
   - Return a prioritized list of untested scenarios
3. Read all files the agent flags as relevant (types, fixtures, related utilities).

## Phase 3: Plan the Tests

For each function or class, identify:
- **Happy path**: normal inputs producing expected output
- **Edge cases**: empty string, null, zero, max value, empty array, negative numbers
- **Error paths**: what happens when a dependency throws, returns null, or times out
- **Async behavior**: resolved promise, rejected promise, timeout

Present the plan briefly. If scope is large, confirm with the user which areas to prioritize.

## Phase 4: Write the Tests

### Structure
- One `describe` block per function or class
- `it`/`test` names read like documentation: `"returns null when user is not found"`
- Arrange–Act–Assert pattern, with a blank line between each section

### Mocking Rules
- Mock external I/O: network calls, database queries, filesystem reads, timers
- Do **not** mock the code under test or its pure logic
- Prefer in-file mock setup; use shared fixtures only when they genuinely reduce duplication

### File Placement
- Match the project's naming convention exactly
- Co-locate with source (`src/lib/auth.test.ts`) unless the project uses `__tests__` directories

## Phase 5: Run and Fix

1. Run the test command scoped to the new file if possible (e.g. `jest src/lib/auth.test.ts`)
2. If a test fails:
   - Read the error carefully — distinguish test bug from source bug
   - Fix the test; if a real source bug is found, flag it to the user
   - Re-run until all new tests are green
3. Optionally run with `--coverage` if the framework supports it

## Output Summary

After completing all phases, report:
- Files created or modified
- Number of new tests by category (happy path / edge case / error path)
- Coverage delta if available
- Any real bugs discovered in the source code
