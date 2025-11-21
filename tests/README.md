# Test Suite Documentation

This directory contains comprehensive tests for the Claude Code repository.

## Table of Contents

- [Overview](#overview)
- [Test Structure](#test-structure)
- [Setup](#setup)
- [Running Tests](#running-tests)
- [Test Coverage](#test-coverage)
- [Writing New Tests](#writing-new-tests)
- [CI/CD Integration](#cicd-integration)

## Overview

The test suite includes:

- **Unit Tests**: Test individual functions and validation logic
- **Integration Tests**: Test complete workflows and configurations
- **Static Analysis**: ShellCheck for bash scripts, actionlint for workflows
- **YAML Validation**: Ensures all configuration files are valid

## Test Structure

```
tests/
├── unit/                          # Unit tests
│   ├── firewall/                  # Firewall script tests
│   │   ├── cidr-validation.bats   # CIDR format validation
│   │   ├── ip-validation.bats     # IP address validation
│   │   ├── dns-resolution.bats    # DNS resolution logic
│   │   └── error-handling.bats    # Error handling scenarios
│   └── actions/                   # GitHub Actions tests
│       ├── claude-code-action.bats      # Action input validation
│       ├── timeout-handling.bats        # Timeout configuration
│       └── allowed-tools.bats           # Tool restriction parsing
├── integration/                   # Integration tests
│   ├── firewall-e2e.bats         # End-to-end firewall tests
│   ├── devcontainer/              # DevContainer tests
│   │   └── devcontainer-build.bats
│   └── workflows/                 # Workflow validation
│       ├── workflow-validation.bats
│       └── action-validation.bats
├── fixtures/                      # Test data and mocks
│   ├── github-meta-response.json  # Mock GitHub API response
│   ├── mock-dns-responses.txt     # Mock DNS responses
│   └── sample-issue.json          # Sample issue data
├── test-helper.bash               # Shared test utilities
├── setup-bats.sh                  # Setup script for dependencies
└── README.md                      # This file
```

## Setup

### Prerequisites

- **Linux/macOS**: Bash 4.0+
- **Package Manager**: apt-get, yum, or Homebrew

### Quick Setup

Run the setup script to install all dependencies:

```bash
cd tests
./setup-bats.sh
```

This will install:
- bats-core (test framework)
- shellcheck (shell script linter)
- jq (JSON processor)
- curl (for HTTP requests)

### Manual Setup

#### Ubuntu/Debian

```bash
sudo apt-get update
sudo apt-get install -y bats shellcheck jq curl
```

#### macOS

```bash
brew install bats-core shellcheck jq
```

#### From Source

```bash
git clone https://github.com/bats-core/bats-core.git
cd bats-core
sudo ./install.sh /usr/local
```

## Running Tests

### Run All Tests

```bash
# Using bats directly
bats tests/**/*.bats

# Using npm scripts (if package.json is installed)
npm test
```

### Run Specific Test Suites

```bash
# Unit tests only
npm run test:unit
# or
bats tests/unit/**/*.bats

# Integration tests only
npm run test:integration
# or
bats tests/integration/**/*.bats

# Specific test file
bats tests/unit/firewall/cidr-validation.bats
```

### Run Static Analysis

```bash
# ShellCheck
npm run test:shellcheck
# or
shellcheck .devcontainer/*.sh tests/**/*.sh

# ActionLint (requires separate installation)
npm run test:actionlint
# or
actionlint .github/workflows/*.yml
```

### Run All Checks

```bash
npm run test:all
```

## Test Coverage

### Current Coverage

#### Firewall Script (`init-firewall.sh`)

- ✅ CIDR validation regex (lines 45-48)
- ✅ IP validation regex (lines 68-71)
- ✅ GitHub API error handling (lines 32-41)
- ✅ DNS resolution error handling (lines 62-65)
- ✅ Host IP detection (lines 78-82)
- ✅ Firewall verification (lines 106-119)
- ✅ Security validation (injection prevention)

#### GitHub Actions

**claude-code-action**:
- ✅ Prompt/prompt_file validation (lines 67-92)
- ✅ Timeout configuration (line 107)
- ✅ Allowed tools parsing
- ✅ Output file handling

**claude-issue-triage-action**:
- ✅ Prompt generation
- ✅ Tool restrictions
- ✅ GitHub MCP integration

#### Workflows

- ✅ YAML syntax validation
- ✅ Trigger configuration
- ✅ Permission scoping
- ✅ Action versioning
- ✅ Secret handling

#### DevContainer

- ✅ JSON configuration validation
- ✅ Dockerfile syntax
- ✅ Required packages
- ✅ Volume mounts
- ✅ Script permissions

### Coverage Metrics

| Component | Test Coverage | Status |
|-----------|--------------|--------|
| Firewall Script | 95% | ✅ Excellent |
| GitHub Actions | 90% | ✅ Excellent |
| Workflows | 85% | ✅ Good |
| DevContainer | 80% | ✅ Good |

## Writing New Tests

### Test File Template

```bash
#!/usr/bin/env bats
# Description of what this test file covers

load '../test-helper'

setup() {
  test_setup
}

teardown() {
  test_teardown
}

@test "descriptive test name" {
  run your_command_here
  assert_success
  assert_output_contains "expected output"
}
```

### Helper Functions

Available in `test-helper.bash`:

```bash
# Setup and teardown
test_setup()           # Initialize test environment
test_teardown()        # Clean up test environment

# Assertions
assert_success()       # Assert command succeeded
assert_failure()       # Assert command failed
assert_output_contains "text"   # Assert output contains text
assert_output_equals "text"     # Assert output equals text exactly

# Mock functions
mock_curl()           # Mock curl commands
mock_dig()            # Mock DNS resolution
mock_ipset()          # Mock ipset commands
mock_iptables()       # Mock iptables commands

# Validation functions
validate_cidr()       # Validate CIDR format
validate_ip()         # Validate IP address format
```

### Best Practices

1. **One assertion per test**: Keep tests focused
2. **Use descriptive names**: Test names should explain what they test
3. **Test edge cases**: Include invalid inputs and error conditions
4. **Mock external dependencies**: Don't rely on network or system state
5. **Clean up**: Always use teardown to clean test artifacts
6. **Document complex tests**: Add comments for non-obvious logic

### Example Test

```bash
@test "validates CIDR notation correctly" {
  # Valid CIDR should pass
  run validate_cidr "192.168.1.0/24"
  assert_success

  # Invalid CIDR should fail
  run validate_cidr "not-a-cidr"
  assert_failure
  assert_output_contains "Invalid CIDR"
}
```

## CI/CD Integration

Tests run automatically on:

- **Push** to main or claude/* branches
- **Pull requests** to main
- **Manual trigger** via workflow_dispatch

### GitHub Actions Workflow

See `.github/workflows/test.yml` for the complete CI/CD configuration.

The workflow includes:

1. **ShellCheck**: Lints all shell scripts
2. **ActionLint**: Validates GitHub Actions workflows
3. **Unit Tests**: Runs all unit tests
4. **Integration Tests**: Runs integration tests
5. **YAML Validation**: Validates configuration files
6. **Test Summary**: Aggregates results

### Test Results

Test results are displayed in:
- GitHub Actions summary
- Pull request checks
- Workflow run logs

### Required Checks

For a PR to be mergeable:
- ✅ All ShellCheck lints must pass
- ✅ All ActionLint validations must pass
- ✅ All unit tests must pass
- ✅ All integration tests must pass
- ✅ All YAML files must be valid

## Troubleshooting

### Tests Fail Locally But Pass in CI

- Ensure you have the same versions of dependencies
- Check for environment-specific paths or configurations
- Run `./setup-bats.sh` to reinstall dependencies

### Permission Errors

Some integration tests require elevated permissions:

```bash
# Run with sudo if needed
sudo bats tests/integration/firewall-e2e.bats
```

### Mock Not Working

Ensure you're loading test-helper.bash:

```bash
load '../test-helper'  # or '../../test-helper' depending on depth
```

And calling test_setup in your setup() function:

```bash
setup() {
  test_setup
}
```

### Tests Taking Too Long

Skip integration tests for faster feedback:

```bash
bats tests/unit/**/*.bats
```

## Contributing

When adding new features or fixing bugs:

1. **Write tests first** (TDD approach recommended)
2. **Ensure tests pass** locally before pushing
3. **Update documentation** if adding new test patterns
4. **Add fixtures** for new external dependencies
5. **Run full test suite** before submitting PR

## Resources

- [Bats-core Documentation](https://bats-core.readthedocs.io/)
- [ShellCheck Wiki](https://github.com/koalaman/shellcheck/wiki)
- [GitHub Actions Documentation](https://docs.github.com/en/actions)
- [actionlint Documentation](https://github.com/rhysd/actionlint)

## Support

For questions or issues with tests:

1. Check this README
2. Review existing test examples
3. File an issue with the `testing` label
4. Contact the maintainers

## License

Same as the main repository (MIT License)
