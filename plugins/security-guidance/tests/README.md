# Security Guidance Plugin - Test Suite

## Overview

This directory contains comprehensive TDD (Test-Driven Development) tests for the security-guidance plugin hooks.

## Test Coverage

### Hooks Tested

1. **`security_reminder_hook.py`** - PreToolUse hook for Edit/Write operations
   - Warns when files contain hardcoded secrets
   - Blocks file edits with API keys, connection strings, etc.

2. **`git_pre_commit_hook.py`** - PreToolUse hook for Bash (git commit) operations
   - Scans staged files before commit
   - **Automatically blocks** commits containing secrets
   - This is the "parachute" that deploys regardless of Claude's intelligence

### Test Cases

| # | Test Name | Hook | Expected Behavior | Status |
|---|-----------|------|-------------------|--------|
| 1 | Edit Hook - Hardcoded API Keys | security_reminder_hook.py | Block (exit 2) | ✅ PASS |
| 2 | Edit Hook - Clean File | security_reminder_hook.py | Allow (exit 0) | ✅ PASS |
| 3 | Edit Hook - Azure Connection String | security_reminder_hook.py | Block (exit 2) | ✅ PASS |
| 4 | Git Hook - Block Commit with Secrets | git_pre_commit_hook.py | Block (exit 2) | ✅ PASS |
| 5 | Git Hook - Allow Clean Commit | git_pre_commit_hook.py | Allow (exit 0) | ✅ PASS |
| 6 | Git Hook - Ignore Non-Git Commands | git_pre_commit_hook.py | Allow (exit 0) | ✅ PASS |

**Total: 6/6 tests passing (100%)**

## Running Tests

### Quick Start

```bash
cd plugins/security-guidance/tests
./run_all_tests.sh
```

### Requirements

- Python 3.x
- Git
- Bash
- jq (for JSON validation)

### What the Tests Do

1. **Setup Phase**
   - Creates temporary git repositories
   - One with staged files containing secrets (`/tmp/test-git-repo`)
   - One with clean files (`/tmp/test-git-repo-clean`)

2. **Execution Phase**
   - Runs each hook with test input JSON
   - Captures exit codes and output
   - Verifies exit codes match expectations

3. **Cleanup Phase**
   - Removes temporary repositories
   - Cleans up session state files

## Test Input Files

- `test-edit-with-api-key.json` - Simulates editing file with AZURE_API_KEY and OPENAI_API_KEY
- `test-edit-clean-file.json` - Simulates editing file with environment variables (safe)
- `test-edit-with-azure-connection.json` - Simulates adding Azure connection string
- `test-git-commit-with-secrets.json` - Simulates git commit with secrets in staged files
- `test-git-commit-clean.json` - Simulates git commit with clean files
- `test-bash-non-git.json` - Simulates non-git bash command

## Exit Codes

The hooks use standard exit codes:

- `0` - Allow/Success (green traffic light)
- `2` - Block/Deny (red traffic light)

## Sample Output

```
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
  Security Guidance Plugin - TDD Test Suite
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

Testing hooks:
  1. security_reminder_hook.py (Edit/Write warnings)
  2. git_pre_commit_hook.py (Git commit blocking)

Setting up test repositories...
✓ Test repositories created

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
  PART 1: Testing security_reminder_hook.py (Edit/Write)
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

Test 1: Edit Hook - Hardcoded API Keys
✅ PASSED
   Exit code: 2 (expected: 2)

Test 2: Edit Hook - Clean File
✅ PASSED
   Exit code: 0 (expected: 0)

...

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
  TEST SUMMARY
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

Total tests: 6
Passed: 6
Failed: 0

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
  ✅ ALL TESTS PASSED!
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

The security hooks are working correctly:
  ✓ Edit/Write hook warns about secrets in file edits
  ✓ Git commit hook blocks commits with secrets
  ✓ Both hooks allow clean code to pass through

This PR is ready for submission with full TDD coverage.
```

## CI/CD Integration

These tests can be run in GitHub Actions or other CI/CD pipelines:

```yaml
- name: Test Security Hooks
  run: |
    cd plugins/security-guidance/tests
    ./run_all_tests.sh
```

## Why These Tests Matter

This test suite proves that the security hooks work **automatically and reliably**, addressing critical security incidents:

- **GitHub Issue #2142**: Multiple API keys exposed
- **GitHub Issue #12524**: Azure OpenAI key → $30,000 USD fraud + job termination

The tests demonstrate that the fix prevents these incidents from happening again.

## Related Documentation

- [Security Guidance Plugin](../README.md)
- [GitHub Issue #2142](https://github.com/anthropics/claude-code/issues/2142)
- [GitHub Issue #12524](https://github.com/anthropics/claude-code/issues/12524)
- [Pull Request #15040](https://github.com/anthropics/claude-code/pull/15040)
