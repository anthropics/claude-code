# Test Writer Plugin

Write comprehensive, idiomatic tests for any codebase. Auto-detects the testing framework, fills coverage gaps, and validates tests run green.

## Overview

The Test Writer Plugin takes the guesswork out of writing tests. It detects your testing framework automatically, analyzes existing coverage to avoid duplication, generates tests across the full spectrum (happy path, edge cases, error paths), and runs them to confirm they pass before finishing.

## Commands

### `/test-writer [path]`

Runs the full 5-phase test-writing workflow on a file, function, or module.

**Usage:**
```bash
/test-writer src/lib/auth.ts
/test-writer handleVote
/test-writer                  # prompts for a target
```

**What it does:**
1. **Detect environment** — finds the testing framework (Jest, Vitest, pytest, Go test, Mocha, etc.), naming convention, and run command
2. **Analyze coverage** — launches the `coverage-analyzer` agent to map all branches and identify untested scenarios
3. **Plan tests** — lists happy path, edge cases, and error paths; confirms scope with the user if it's large
4. **Write tests** — creates idiomatic, framework-matching tests with Arrange-Act-Assert structure
5. **Run and fix** — executes the test suite and fixes any failures before returning

**Output:**
- Files created or modified
- Number of new tests by category (happy path / edge case / error path)
- Coverage improvement estimate (if the framework supports `--coverage`)
- Any real bugs discovered in the source code

## Agents

### `coverage-analyzer`

Launched automatically by `/test-writer` during Phase 2. Can also be invoked standalone to audit coverage before deciding whether to write new tests.

**What it does:**
1. Reads the target file and maps every exported symbol, branch, async path, thrown error, and side effect
2. Finds existing test files (`*.test.*`, `*.spec.*`, `*_test.*`, `__tests__/`) and reads them fully
3. Compares branches against covered scenarios to identify gaps
4. Returns a prioritized report:
   - **Priority 1 (Critical)** — public functions with no tests, entirely untested error paths
   - **Priority 2 (Edge Cases)** — boundary values, null/empty inputs, large inputs
   - **Priority 3 (Nice to Have)** — equivalent paths, minor branches, defensive checks

**Example output:**
```
## Coverage Gaps (prioritized)

### Priority 1 — Critical
- [ ] login(): error path when Supabase throws — currently no test for auth failure
- [ ] resetPassword(): no tests at all

### Priority 2 — Edge Cases
- [ ] login(): empty email string
- [ ] login(): password exceeding 72-character bcrypt limit
```

## Skills

### `test-writer` (auto-invoked)

Activated automatically when you ask Claude to write or add tests (e.g., "write tests for X", "add test coverage to this file", "test this function"). Provides the same systematic framework-detection and gap-analysis workflow without needing to type `/test-writer`.

## Supported Testing Frameworks

| Language | Frameworks Detected |
|----------|---------------------|
| TypeScript / JavaScript | Jest, Vitest, Mocha, Jasmine |
| Python | pytest, unittest |
| Go | `go test` |
| Ruby | RSpec, Minitest |
| Rust | built-in `#[test]` |

## Example Workflow

```
User: /test-writer src/lib/auth.ts

Claude: [Phase 1] Detected Vitest with TypeScript. Test files use *.test.ts naming.
        Run command: npx vitest run

        [Phase 2] Launching coverage-analyzer...
        Found 1 existing test file: src/lib/auth.test.ts (covers login happy path only)

        Gaps identified:
        - Priority 1: login() error path (no test)
        - Priority 1: logout() — no tests at all
        - Priority 2: login() with empty credentials

        [Phase 3] Plan: 4 new tests across 2 functions

        [Phase 4] Writing tests...

        [Phase 5] Running: npx vitest run src/lib/auth.test.ts
        ✓ 4 tests passed

        Summary: 4 new tests added (1 happy path, 1 edge case, 2 error paths).
        No bugs found in source code.
```
