# Testing Guide

This document describes the testing infrastructure for the Claude Code repository.

## Overview

The Claude Code repository uses a comprehensive testing strategy to ensure the quality and reliability of:
- Shell scripts (firewall configuration)
- GitHub Actions workflows
- GitHub Actions (reusable actions)
- Configuration files
- Security best practices

## Test Structure

```
tests/
├── shell/                    # Shell script tests (Bats)
│   └── init-firewall.bats   # Firewall script tests
├── actions/                  # GitHub Actions tests
│   ├── claude-code-action.test.yml
│   └── claude-issue-triage.test.yml
├── config/                   # Configuration validation (Jest)
│   ├── validate-json.test.js
│   └── validate-workflows.test.js
└── test_helper/              # Test utilities (auto-installed)
    ├── bats-support/
    └── bats-assert/
```

## Running Tests

### All Tests

```bash
npm test
```

This runs all test suites:
- Configuration tests (Jest)
- Shell script tests (Bats)
- YAML linting
- Shell script linting

### Individual Test Suites

```bash
# Configuration and workflow validation tests
npm run test:config

# Shell script tests
npm run test:shell

# YAML linting
npm run lint:yaml

# Shell script linting
npm run lint:shell

# All linting
npm run lint

# Full validation (lint + test)
npm run validate
```

### Watch Mode (for development)

```bash
npm run test:watch
```

## Test Categories

### 1. Shell Script Tests (Bats)

**Location:** `tests/shell/init-firewall.bats`

**Purpose:** Test the `.devcontainer/init-firewall.sh` script for:
- Input validation (CIDR ranges, IP addresses)
- Error handling
- Security configurations
- Firewall rules
- Required domains and APIs

**Running:**
```bash
npm run test:shell
# or
bats tests/shell/
```

**Key Tests:**
- CIDR format validation
- IP address validation
- GitHub API integration
- DNS resolution error handling
- Firewall rule verification
- No hardcoded credentials

### 2. Configuration Tests (Jest)

**Location:** `tests/config/`

**Purpose:** Validate JSON and configuration files:
- `devcontainer.json` structure
- `extensions.json` format
- `package.json` integrity
- `Dockerfile` best practices

**Running:**
```bash
npm run test:config
```

**Key Tests:**
- Valid JSON syntax
- Required fields present
- Extension IDs format
- Version number formats
- Security checks (no hardcoded secrets)

### 3. Workflow Tests (Jest)

**Location:** `tests/config/validate-workflows.test.js`

**Purpose:** Validate GitHub Actions workflows:
- Trigger conditions
- Security configurations
- Required secrets
- Proper permissions
- Action versions

**Running:**
```bash
npm run test:config
```

**Key Tests:**
- `claude.yml` triggers on @claude mentions
- `claude-issue-triage.yml` has proper permissions
- `docker-publish.yml` security (signing, no push on PRs)
- No hardcoded secrets
- Proper secret references

### 4. GitHub Actions Tests

**Location:** `tests/actions/*.test.yml`

**Purpose:** Test GitHub Actions input validation and logic

**Tests:**
- `claude-code-action.test.yml` - Input validation, prompt handling
- `claude-issue-triage.test.yml` - Prompt templating, tool restrictions

**Note:** These tests run in GitHub Actions environment. To test locally, use [act](https://github.com/nektos/act):

```bash
# Install act
brew install act  # macOS
# or
curl https://raw.githubusercontent.com/nektos/act/master/install.sh | sudo bash

# Run action tests
act -j test-missing-prompt -W tests/actions/claude-code-action.test.yml
```

### 5. Linting

**YAML Linting:**
```bash
npm run lint:yaml
```

Uses `yamllint` to check:
- YAML syntax
- Indentation
- Line length
- Consistent formatting

**Shell Linting:**
```bash
npm run lint:shell
```

Uses `shellcheck` to check:
- Potential bugs
- Syntax errors
- Best practices
- Security issues

## Pre-commit Hooks

The repository uses [pre-commit](https://pre-commit.com/) to run checks before commits.

### Installation

```bash
# Install pre-commit (choose one method)
pip install pre-commit
# or
brew install pre-commit

# Install the git hooks
pre-commit install
```

### What Gets Checked

On every commit:
- Trailing whitespace removal
- End of file fixes
- YAML syntax validation
- JSON syntax validation
- Large file detection
- Merge conflict markers
- ShellCheck
- YAML linting
- Prettier formatting
- No hardcoded secrets
- No TODOs in workflows

### Running Manually

```bash
# Run on all files
pre-commit run --all-files

# Run on staged files
pre-commit run

# Run specific hook
pre-commit run shellcheck --all-files
```

### Skipping Hooks (when necessary)

```bash
# Skip all hooks (use sparingly)
git commit --no-verify

# Skip specific hooks via SKIP env var
SKIP=shellcheck git commit
```

## Continuous Integration

Tests run automatically on:
- **Push** to `main` or `claude/**` branches
- **Pull requests** to `main`
- **Manual trigger** via workflow_dispatch

### CI Workflow

The `.github/workflows/test.yml` workflow runs:

1. **Configuration Tests** - Jest tests for config files
2. **Shell Tests** - Bats tests for shell scripts
3. **YAML Lint** - Validate all YAML files
4. **Shell Lint** - ShellCheck on all shell scripts
5. **Action Tests** - Validate GitHub Actions
6. **Workflow Validation** - Ensure workflows are parseable
7. **Security Checks** - Scan for hardcoded secrets
8. **Coverage Summary** - Generate coverage report

### Viewing Results

Check the Actions tab on GitHub to see test results:
- ✅ Green checkmark = all tests passed
- ❌ Red X = tests failed (click for details)

## Coverage Reports

Test coverage is tracked using Jest's built-in coverage:

```bash
# Generate coverage report
npm run test:config

# View coverage
open coverage/index.html  # macOS
xdg-open coverage/index.html  # Linux
```

Coverage reports are uploaded to [Codecov](https://codecov.io) on CI runs.

### Coverage Goals

- **Configuration tests:** 80%+ coverage
- **Workflow validation:** 100% of workflows tested
- **Shell scripts:** 100% of critical security functions tested

## Writing New Tests

### Adding Shell Script Tests

1. Create or edit `tests/shell/<script-name>.bats`
2. Use bats-assert for readable assertions
3. Test both success and failure cases
4. Include security checks

Example:
```bash
@test "validates IP address format" {
    run validate_ip "192.168.1.1"
    assert_success

    run validate_ip "invalid"
    assert_failure
}
```

### Adding Configuration Tests

1. Create or edit `tests/config/<name>.test.js`
2. Use Jest matchers
3. Test file existence, syntax, and content

Example:
```javascript
describe('new-config.json', () => {
    test('is valid JSON', () => {
        const config = JSON.parse(fs.readFileSync('new-config.json'));
        expect(config).toBeDefined();
    });
});
```

### Adding Action Tests

1. Create `tests/actions/<action-name>.test.yml`
2. Test input validation
3. Test error conditions
4. Use `continue-on-error: true` for tests that should fail

Example:
```yaml
- name: Test with invalid input
  id: test
  continue-on-error: true
  uses: ./.github/actions/my-action
  with:
    invalid_input: "test"

- name: Verify failure
  if: steps.test.outcome == 'success'
  run: exit 1
```

## Debugging Tests

### Shell Tests (Bats)

```bash
# Run with verbose output
bats -t tests/shell/init-firewall.bats

# Run single test
bats tests/shell/init-firewall.bats -f "validates IP"

# Debug mode
bats tests/shell/init-firewall.bats --verbose-run
```

### Configuration Tests (Jest)

```bash
# Run with verbose output
npm run test:config -- --verbose

# Run single test file
npm run test:config -- validate-json.test.js

# Run tests matching pattern
npm run test:config -- -t "devcontainer"

# Debug mode
node --inspect-brk node_modules/.bin/jest --runInBand
```

## Common Issues

### Bats Tests Failing

**Issue:** `bats: command not found`
**Solution:** Install bats: `npm install` or `sudo apt-get install bats`

**Issue:** `bats-assert not found`
**Solution:** Clone helpers:
```bash
mkdir -p tests/test_helper
git clone https://github.com/bats-core/bats-support.git tests/test_helper/bats-support
git clone https://github.com/bats-core/bats-assert.git tests/test_helper/bats-assert
```

### Jest Tests Failing

**Issue:** `Cannot find module`
**Solution:** Run `npm install` to install dependencies

**Issue:** `ENOENT: no such file or directory`
**Solution:** Check file paths are relative to repository root

### Pre-commit Issues

**Issue:** `pre-commit: command not found`
**Solution:** Install pre-commit: `pip install pre-commit` or `brew install pre-commit`

**Issue:** Hooks not running
**Solution:** Run `pre-commit install` to install git hooks

## Best Practices

1. **Write tests first** - TDD approach for new features
2. **Test failure cases** - Don't just test happy paths
3. **Keep tests fast** - Mock external dependencies
4. **Use descriptive names** - Test names should explain what they test
5. **Don't commit commented tests** - Remove or fix instead
6. **Update tests with code changes** - Keep tests in sync
7. **Run tests before committing** - Use pre-commit hooks
8. **Check coverage** - Aim for high coverage on critical code

## Resources

- [Bats Documentation](https://bats-core.readthedocs.io/)
- [Jest Documentation](https://jestjs.io/docs/getting-started)
- [GitHub Actions Documentation](https://docs.github.com/en/actions)
- [ShellCheck Wiki](https://www.shellcheck.net/wiki/)
- [Pre-commit Documentation](https://pre-commit.com/)
- [YAML Lint Rules](https://yamllint.readthedocs.io/)

## Getting Help

If you encounter issues with tests:

1. Check this documentation
2. Review test output carefully
3. Run tests in verbose/debug mode
4. Check CI logs on GitHub Actions
5. Ask in pull request comments

## Contributing

When contributing:

1. Ensure all tests pass: `npm test`
2. Add tests for new features
3. Update tests for bug fixes
4. Run linters: `npm run lint`
5. Check coverage doesn't decrease
6. Update this documentation if needed

---

**Note:** This testing infrastructure ensures the Claude Code repository maintains high quality and security standards. All contributions should include appropriate tests.
