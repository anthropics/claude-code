# verify

Run manual verification of claims made in this session.

## Usage

```
/verify-claims:verify [claim_type]
```

## Arguments

- `claim_type` (optional): Specific claim type to verify. Options:
  - `files` - Verify file creation claims
  - `tests` - Run test verification
  - `lint` - Run lint verification
  - `build` - Run build verification
  - `all` - Run all verifications (default)

## Examples

```
/verify-claims:verify          # Verify all claims
/verify-claims:verify tests    # Only run test verification
/verify-claims:verify files    # Only check file existence
```

## Behavior

When invoked, this command will:

1. Parse recent assistant messages for verifiable claims
2. Run appropriate verification checks
3. Report results for each claim found

### Claim Types Detected

| Type | Patterns | Verification |
|------|----------|--------------|
| `file_created` | "I created...", "wrote to..." | Check file exists |
| `tests_pass` | "tests pass", "all tests passing" | Run test suite |
| `lint_clean` | "no lint errors" | Run linter |
| `build_success` | "build succeeded" | Run build |
| `bug_fixed` | "fixed the bug" | Check git diff |

## Configuration

Override verification commands in `.claude/verify-claims.json`:

```json
{
  "verifiers": {
    "tests_pass": { "command": "npm run test:unit" },
    "lint_clean": { "command": "npm run lint:strict" }
  }
}
```

---

**Instructions for Claude:**

When the user invokes `/verify-claims:verify`, perform the following steps:

1. Read the session transcript to get recent assistant messages
2. Parse those messages for verifiable claims using these patterns:
   - File creation: Look for mentions of creating/writing files
   - Test claims: Look for "tests pass" or similar
   - Lint claims: Look for "no lint errors" or similar
   - Build claims: Look for "build succeeded" or similar
   - Bug fix claims: Look for "fixed the bug" or similar

3. For each claim found, run the appropriate verification:
   - **file_created**: Check if the mentioned file exists using `ls -la`
   - **tests_pass**: Run the project's test command (npm test, pytest, cargo test, etc.)
   - **lint_clean**: Run the project's lint command (npm run lint, ruff, eslint, etc.)
   - **build_success**: Run the project's build command (npm run build, cargo build, etc.)
   - **bug_fixed**: Check `git diff` to confirm code changes were made

4. Report results in a clear format:
   ```
   ## Verification Results

   ✓ file_created: src/components/Button.tsx exists
   ✓ tests_pass: All 42 tests passed (npm test)
   ✗ lint_clean: 3 lint errors found
   ```

5. If any verifications fail, provide actionable next steps.

**Note**: Only verify claims that were actually made. Don't run tests if no test-related claims were found.
