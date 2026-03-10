---
description: Generate unit tests for a source file
argument-hint: <file-path> [--framework <jest|vitest|mocha|pytest|go-test>] [--output <path>] [--preview] [--force] [--coverage-hints]
allowed-tools: Read, Write, Glob, Grep, Bash(cat:*), Bash(find:*), Bash(test:*), AskUserQuestion
---

<!--
Usage:
  /create-test src/services/authService.ts
  /create-test src/utils/parser.py --framework pytest
  /create-test pkg/api/handler.go --output pkg/api/handler_test.go
  /create-test src/lib/math.ts --preview
  /create-test src/lib/math.ts --force --coverage-hints

Flags:
  --framework <name>   Override auto-detected framework (jest|vitest|mocha|pytest|go-test)
  --output <path>      Write test file to a custom path instead of the inferred default
  --preview            Show the generated test file content but do NOT write it to disk
  --force              Overwrite an existing test file without prompting
  --coverage-hints     Emit extra boundary / edge-case tests for better coverage
-->

# Generate Unit Tests for $ARGUMENTS

## Step 0: Parse Arguments

Extract from "$ARGUMENTS":
- `file_path`: the first positional argument (the source file to test)
- `framework_override`: value of `--framework` flag (if provided)
- `output_override`: value of `--output` flag (if provided)
- `preview_only`: true if `--preview` flag is present (show test content, do not write)
- `force_overwrite`: true if `--force` flag is present (skip "file exists" prompt)
- `coverage_hints`: true if `--coverage-hints` flag is present

If no file path was provided, stop and explain:
> Usage: /create-test <file-path> [--framework <jest|vitest|mocha|pytest|go-test>] [--output <path>] [--preview] [--force] [--coverage-hints]

## Step 1: Validate Source File

Check that the source file exists: !`test -f $1 && echo "EXISTS" || echo "MISSING"`

If the file is MISSING, stop and report:
> Error: File not found: $1
> Please provide a valid path to the source file you want to test.

## Step 2: Read the Source File

Read the source file at `$1` in full.

## Step 3: Detect Project Language and Testing Framework

Detect the language from the file extension:
- `.ts`, `.tsx` → TypeScript
- `.js`, `.jsx` → JavaScript
- `.py` → Python
- `.go` → Go
- `.rs` → Rust
- `.java` → Java
- `.rb` → Ruby

If `--framework` was provided, use that framework. Otherwise, auto-detect:

**For TypeScript/JavaScript projects**, check config files:
- Look for `package.json` (run: !`test -f package.json && cat package.json || echo "NOT_FOUND"`)
- Check `devDependencies` and `scripts.test` for: jest, vitest, mocha, jasmine
- Also check: `jest.config.*`, `vitest.config.*`

**For Python projects**:
- Look for `pyproject.toml`: !`test -f pyproject.toml && cat pyproject.toml || echo "NOT_FOUND"`
- Look for `requirements*.txt`, `setup.py`, `pytest.ini`, `setup.cfg`
- Default to pytest if Python file and no clear signal

**For Go projects**:
- Look for `go.mod`: !`test -f go.mod && cat go.mod || echo "NOT_FOUND"`
- Go test is always the framework for `.go` files

If auto-detection is ambiguous, use AskUserQuestion:

**Question - Framework:**
- header: "Test framework"
- question: "Which test framework should I use for the generated tests?"
- options:
  - Jest (Popular Node.js testing with mocking built-in)
  - Vitest (Fast Vite-native test runner, Jest-compatible)
  - Pytest (Python's most popular test framework)
  - Go test (Built-in Go testing package)

## Step 4: Discover Existing Test Conventions

Search for existing test files to understand the project's conventions:

- Find test files: !`find . -type f \( -name "*.test.ts" -o -name "*.test.js" -o -name "*.spec.ts" -o -name "*.spec.js" -o -name "*_test.go" -o -name "test_*.py" -o -name "*_test.py" \) -not -path "*/node_modules/*" -not -path "*/.git/*" | head -10`
- Check for a `__tests__` or `tests` directory: !`find . -maxdepth 3 -type d \( -name "__tests__" -o -name "tests" -o -name "test" -o -name "spec" \) -not -path "*/node_modules/*" | head -5`

Read 1-2 representative existing test files (if any) to understand:
- Import style (named vs default imports, aliasing)
- Describe/it/test block naming conventions
- Mock patterns (jest.mock, vi.mock, unittest.mock, etc.)
- Setup/teardown patterns (beforeEach, afterEach, fixtures)
- Assertion style (expect, assert, etc.)

## Step 5: Analyze the Source File

From the source file you read in Step 2, identify:

1. **Exported symbols**: functions, classes, constants, types
2. **Function signatures**: name, parameters (names, types, defaults), return type
3. **Dependencies / imports**: external modules, internal modules that will need mocking
4. **Error cases**: thrown exceptions, rejected promises, error return values
5. **Side effects**: I/O, network calls, DB access, file system, timers
6. **Edge cases per function**: empty inputs, null/undefined, boundary values, large inputs

## Step 6: Determine Test File Location

If `--output` was provided, use that path.

Otherwise, infer from existing conventions:
- If existing tests are **co-located** (e.g., `src/foo.test.ts` next to `src/foo.ts`) → place test next to source
- If existing tests are in a **`__tests__` folder** (e.g., `src/__tests__/foo.test.ts`) → mirror structure inside `__tests__`
- If existing tests are in a top-level **`tests/` or `test/` folder** → mirror the source tree under that folder
- Default if no convention detected: co-locate with source file

Construct `test_file_path` accordingly:
- TypeScript: replace `.ts`/`.tsx` with `.test.ts` (or `.spec.ts` if project uses `.spec`)
- JavaScript: replace `.js`/`.jsx` with `.test.js`
- Python: prefix filename with `test_` or suffix with `_test.py` per project convention
- Go: replace `foo.go` with `foo_test.go` in the same directory

Check if test file already exists: !`test -f <test_file_path> && echo "EXISTS" || echo "NOT_FOUND"`

If test file already EXISTS:
- If `force_overwrite` is true → proceed silently (no prompt needed).
- Otherwise, use AskUserQuestion:

**Question - Existing file:**
- header: "File exists"
- question: "A test file already exists at `<test_file_path>`. What should I do?"
- options:
  - Overwrite (Replace it with newly generated tests)
  - Merge (Show me both so I can decide what to keep)
  - Cancel (Stop without creating a new test file)

If "Cancel" → stop.
If "Merge" → read the existing test file and note what already exists; avoid duplicating covered cases; generate only missing tests.

## Step 7: Generate the Test File

Generate a complete, idiomatic test file following:
- The detected framework's conventions
- The project's existing style (from Step 4)
- Coverage of all cases identified in Step 5

### Quality requirements:
- Each exported function/class gets its own `describe` block
- Include: success/happy-path tests, error/edge-case tests, boundary tests
- Mock all external dependencies (network, DB, file system, timers)
- Use descriptive test names: `it("should return null when input is empty", ...)`
- If `--coverage-hints` was provided, add extra edge-case tests (empty arrays, zero values, very large inputs, concurrent calls, etc.)
- Do NOT write empty test stubs — every test must have a meaningful assertion
- Keep tests independent (no shared mutable state between tests)
- Use `beforeEach`/`afterEach` for setup and teardown where appropriate

### Example structure (TypeScript / Jest):
```typescript
import { functionName } from './sourceFile';
import { Dependency } from './dependency';

jest.mock('./dependency');

describe('functionName()', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('should return expected value for valid input', () => {
    // arrange
    // act
    // assert
  });

  it('should throw an error when input is invalid', () => {
    // arrange / act / assert
  });
});
```

## Step 8: Preview and Confirm

Display the full generated test file contents to the user.

If `preview_only` is true → stop here. Report:
> Preview complete. File NOT written (--preview flag is set).
> To write the file, run the same command without --preview.

Otherwise, use AskUserQuestion:

**Question - Confirm write:**
- header: "Write file?"
- question: "Write the test file to `<test_file_path>`?"
- options:
  - Yes (Write the file now)
  - No (Show only, don't write)

If "No" → stop after showing the preview. Do not write anything.

## Step 9: Write the Test File

If the user confirmed "Yes", write the generated test file to `<test_file_path>`.

After writing, report:
> Test file created: `<test_file_path>`
>
> **Next steps:**
> - Run your test suite to verify: `<test_run_command>`
> - Fill in any TODO comments where context outside this file is needed
> - Consider running with coverage: `<coverage_command>`
