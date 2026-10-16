---
description: Write comprehensive tests for a file, function, or module. Auto-detects the testing framework and runs the tests to verify they pass.
argument-hint: Optional path or function name to test (e.g. "src/lib/auth.ts" or "handleVote")
---

# Test Writer

You are helping a developer write comprehensive, idiomatic tests. Follow a systematic approach: detect the framework, understand the code under test, write complete tests, then verify they pass.

## Core Principles

- **Framework-idiomatic**: Match the project's existing test style exactly — assertions, mocking patterns, file naming, describe/it structure.
- **Meaningful coverage**: Test the happy path, edge cases, error branches, and boundary conditions. Don't just chase coverage numbers.
- **Self-verifying**: Always run the tests after writing them. Fix failures before returning results.
- **No mocking what you shouldn't**: Mock external I/O (network, DB, filesystem). Don't mock the code under test or its pure logic.
- **Use TodoWrite**: Track progress throughout.

---

## Phase 1: Detect the Environment

**Goal**: Understand the testing setup before writing a single line.

Target: $ARGUMENTS

**Actions**:
1. Create a todo list with all phases.
2. Run the detection agent to identify:
   - Testing framework (Jest, Vitest, pytest, Go test, Mocha, etc.)
   - Test file naming convention (`*.test.ts`, `*.spec.py`, `_test.go`, etc.)
   - Assertion style (expect/assert/should)
   - Existing mock utilities (vi.mock, jest.mock, unittest.mock, etc.)
   - How to run tests (`npm test`, `pytest`, `go test ./...`, etc.)
3. Read 2-3 existing test files to internalize the project's style.

---

## Phase 2: Understand the Code Under Test

**Goal**: Know exactly what to test and how it behaves.

**Actions**:
1. If `$ARGUMENTS` names a file or function, read it now. Otherwise, ask the user which code to test.
2. Launch the `coverage-analyzer` agent to:
   - Map all exported functions, classes, and branches in the target.
   - Identify already-tested paths (read existing test files for the target if they exist).
   - Return a prioritized list of untested or under-tested scenarios.
3. Read all files the agent identifies as relevant (dependencies, types, mocks).
4. Summarize what needs to be tested and confirm with the user if scope is ambiguous.

---

## Phase 3: Plan the Tests

**Goal**: Decide exactly which tests to write before writing them.

**Actions**:
1. For each function/class/module, list:
   - Happy path(s)
   - Edge cases (empty input, null, zero, max values, etc.)
   - Error paths (what happens when dependencies throw or return bad data)
   - Any async/timing behavior
2. Present the plan briefly. If the user has preferences (e.g. "just the happy paths for now"), adjust.

---

## Phase 4: Write the Tests

**Goal**: Write complete, runnable tests.

**Actions**:
1. Create or append to the appropriate test file (match naming convention).
2. Write tests according to the plan. For each test:
   - Clear `describe`/`it` or equivalent names that read like documentation.
   - Arrange-Act-Assert structure.
   - Minimal setup — share fixtures only when they genuinely reduce duplication.
3. For mocking:
   - Mock only at the boundary (external calls, I/O, time).
   - Prefer in-file mock setup over shared global mocks unless the project already uses them.

---

## Phase 5: Run and Fix

**Goal**: All written tests must pass before returning.

**Actions**:
1. Run the test command identified in Phase 1 (scoped to the new tests if possible).
2. If any test fails:
   - Read the error output carefully.
   - Fix the test (or the code, if a real bug was found — flag it to the user).
   - Re-run until green.
3. Report the final result: number of tests written, pass/fail, and any bugs discovered.

---

## Output

Finish with a short summary:
- Files modified/created
- Number of new tests (broken down by category: happy path / edge case / error path)
- Coverage improvement estimate if the framework supports it (`--coverage`)
- Any real bugs found in the source code during testing
