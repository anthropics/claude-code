---
description: Analyze a source file and generate a comprehensive unit test file with automatic framework detection, dependency mocking, and structured test suites
argument-hint: <file-path> [--framework jest|vitest|mocha|pytest|go-test] [--output <path>] [--preview] [--force]
allowed-tools: ["Read", "Write", "Grep", "Glob", "Bash", "TodoWrite", "Task"]
---

Generate a unit test file for the given source file by analyzing its structure and following the project's existing testing conventions.

**Arguments:** $ARGUMENTS

---

## Setup

Create a todo list with these phases:
- [ ] Parse arguments
- [ ] Validate source file
- [ ] Detect test framework
- [ ] Determine output path
- [ ] Check for existing test file
- [ ] Analyze source file (source-analyzer agent)
- [ ] Generate test file (test-generator agent)
- [ ] Preview (if --preview)
- [ ] Write test file

---

## Phase 1: Parse Arguments

From `$ARGUMENTS`, extract:
- `file_path` — the first positional argument (e.g., `src/services/authService.ts`)
- `--framework <value>` — optional framework override: `jest`, `vitest`, `mocha`, `pytest`, or `go-test`
- `--output <value>` — optional custom path for the generated test file
- `--preview` — flag: show the generated test before writing it
- `--force` — flag: overwrite an existing test file

If `file_path` is missing or empty, report: "Usage: /create-test <file-path> [options]" and stop.

---

## Phase 2: Validate Source File

Read the file at `file_path`. If the file does not exist or cannot be read, report the error and stop.

---

## Phase 3: Detect Test Framework

Skip this phase if `--framework` was explicitly provided.

Search the project root for configuration files and detect the framework:

1. If `package.json` exists, read it and check `devDependencies` and `dependencies`:
   - `"vitest"` present → **vitest**
   - `"jest"` or `"@jest/core"` or `"ts-jest"` present → **jest**
   - `"mocha"` present → **mocha**
2. If `requirements.txt` or `pyproject.toml` exists, check for `pytest` → **pytest**
3. If `go.mod` exists → **go-test**
4. If nothing is detected, default to **jest**

---

## Phase 4: Determine Output Path

If `--output` was provided, use that path as the output. Skip to Phase 5.

Otherwise, determine the output path automatically:

**1. Naming convention** (based on framework and language):
- TypeScript/JavaScript (jest, vitest, mocha): `authService.ts` → `authService.test.ts` or `authService.spec.ts`
  - Check whether existing test files in the project use `.test.` or `.spec.` suffix and match that convention. Default to `.test.`.
- Python (pytest): `auth_service.py` → `test_auth_service.py`
- Go (go-test): `auth_service.go` → `auth_service_test.go`

**2. Test file location** (check in this order):
- Look for a `__tests__/` directory adjacent to the source file or in the source file's parent. If found, place the test there.
- Look for a root-level `tests/` or `test/` directory mirroring the source path (e.g., `src/services/authService.ts` → `tests/services/authService.test.ts`). If found, use it.
- Check if other test files exist alongside source files in the same directory (colocated pattern). If found, collocate the new test.
- Default: place the test file in the same directory as the source file.

---

## Phase 5: Check for Existing Test File

Check if a file already exists at the output path.

If it exists and `--force` is **not** set:
- Report: "Test file already exists at `<output_path>`. Use --force to overwrite."
- Stop.

---

## Phase 6: Analyze Source File

Launch the **source-analyzer** agent. Provide it with:
- The full file path
- The full file contents
- The detected language/extension

The agent returns a structured analysis. Record the output — you will pass it to the test-generator in Phase 7.

---

## Phase 7: Generate Test File

Launch the **test-generator** agent. Provide it with:
- The structured analysis from Phase 6
- The detected (or specified) framework name
- The original source file path and its full contents
- The output test file path
- The naming conventions observed in the project (from Phase 4)

The agent returns the complete, ready-to-write test file content. Record this content.

---

## Phase 8: Preview

If `--preview` was specified, display the generated test content in a code block. Then ask the user:
"Write this test file to `<output_path>`?"

If the user says no, stop.

---

## Phase 9: Write Test File

Write the generated test content to the output path.

Report success:
```
✓ Test file created: <output_path>
  Framework: <framework>
  Source:    <file_path>
```

List any key TODOs that the developer should complete (mocks, assertions, test data).

---

## Notes

- Never overwrite an existing test file unless `--force` is explicitly set
- All generated tests include `TODO` comments to guide developers completing the implementation
- The command mirrors the project's existing test conventions rather than imposing new ones
- External imports (databases, APIs, HTTP clients) are mocked with placeholder stubs
