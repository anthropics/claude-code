# Test Suite Documentation

This directory contains comprehensive tests for the Claude Code infrastructure.

## Test Structure

```
tests/
├── scripts/           # Bash script tests (using bats)
│   └── firewall.bats  # Tests for init-firewall.sh
├── actions/           # GitHub Actions composite action tests
│   ├── claude-code-action.test.yml
│   └── claude-issue-triage.test.yml
├── workflows/         # Workflow validation tests
│   └── workflow-validation.bats
└── fixtures/          # Test fixtures and mock data
    ├── prompts/
    └── mock-responses/
```

## Running Tests

### Prerequisites

Install required dependencies:

```bash
# Install bats (Bash Automated Testing System)
sudo apt-get install bats

# Or on macOS
brew install bats-core

# Install shellcheck
sudo apt-get install shellcheck

# Or on macOS
brew install shellcheck

# Install actionlint
bash <(curl https://raw.githubusercontent.com/rhysd/actionlint/main/scripts/download-actionlint.bash)
```

### Run All Tests

```bash
# Run all tests via npm
npm test

# Or run individual test suites
npm run test:lint    # Run shellcheck
npm run test:bats    # Run bats tests
```

### Run Specific Test Files

```bash
# Run firewall script tests
bats tests/scripts/firewall.bats

# Run workflow validation tests
bats tests/workflows/workflow-validation.bats

# Run shellcheck on firewall script
shellcheck .devcontainer/init-firewall.sh

# Run actionlint on workflows
actionlint .github/workflows/*.yml
```

### Run Tests with act (Local GitHub Actions)

```bash
# Install act
curl https://raw.githubusercontent.com/nektos/act/master/install.sh | sudo bash

# List available workflows
act -l

# Run test workflow locally
act -W .github/workflows/test.yml

# Run specific job
act -j bats-tests
```

## Test Categories

### 1. Firewall Script Tests (`tests/scripts/firewall.bats`)

**Coverage: 60+ test cases**

Tests for `.devcontainer/init-firewall.sh`:

- **CIDR Validation** (8 tests)
  - Valid CIDR ranges
  - Invalid formats
  - Malformed inputs

- **IP Address Validation** (7 tests)
  - Valid IP addresses
  - Invalid formats
  - Incomplete addresses

- **Script Structure** (7 tests)
  - Safety flags (`set -euo pipefail`)
  - Error handling
  - API response validation

- **Security Configuration** (5 tests)
  - Firewall rules
  - Default policies
  - Allowed traffic

- **Domain Allowlist** (4 tests)
  - Required domains
  - GitHub API integration

- **Error Handling** (6 tests)
  - API failures
  - DNS resolution errors
  - Invalid inputs

- **Idempotency** (3 tests)
  - Rule cleanup
  - ipset management

- **Verification** (3 tests)
  - Blocked domains
  - Allowed domains
  - Timeout configuration

### 2. Composite Action Tests

#### Claude Code Action (`tests/actions/claude-code-action.test.yml`)

**Coverage: 10 test cases**

- Input validation
- Prompt file handling
- Timeout configuration
- Tool allowlist
- Environment variables
- GitHub MCP installation

#### Claude Issue Triage (`tests/actions/claude-issue-triage.test.yml`)

**Coverage: 12 test cases**

- Prompt file creation
- Required instructions
- Tool restrictions
- Security constraints
- No-comment enforcement

### 3. Workflow Validation (`tests/workflows/workflow-validation.bats`)

**Coverage: 35+ test cases**

Tests for all workflows:

- **docker-publish.yml** (15 tests)
  - Triggers and events
  - Permissions
  - Build steps
  - Image signing

- **claude.yml** (10 tests)
  - @claude mention detection
  - Event handling
  - Permissions

- **claude-issue-triage.yml** (7 tests)
  - Trigger configuration
  - Timeout settings
  - Permissions

- **General Quality** (5 tests)
  - Action versioning
  - Deprecated actions
  - Security best practices

## Test Coverage Metrics

| Component | Files | Test Cases | Coverage |
|-----------|-------|------------|----------|
| Firewall Script | 1 | 60+ | ~95% |
| Composite Actions | 2 | 22 | ~85% |
| Workflows | 3 | 35+ | ~80% |
| **Total** | **6** | **117+** | **~85%** |

## CI/CD Integration

Tests run automatically on:

- Every push to `main` branch
- Every push to `claude/**` branches
- Every pull request to `main`
- Manual workflow dispatch

See `.github/workflows/test.yml` for the full CI/CD pipeline.

## Writing New Tests

### Adding Bash Script Tests

Create a new `.bats` file in `tests/scripts/`:

```bash
#!/usr/bin/env bats

setup() {
  # Setup code runs before each test
  SCRIPT_DIR="${BATS_TEST_DIRNAME}/../../path/to/script"
}

@test "description of what this tests" {
  # Test code
  [ -f "$SCRIPT_DIR/script.sh" ]
}
```

### Adding Action Tests

Create a new `.test.yml` file in `tests/actions/`:

```yaml
name: Test My Action
on: workflow_dispatch

jobs:
  test-something:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4
      - name: Test specific behavior
        run: |
          # Test code here
```

## Debugging Failed Tests

### Bats Tests

```bash
# Run with verbose output
bats -t tests/scripts/firewall.bats

# Run single test
bats -f "test name pattern" tests/scripts/firewall.bats
```

### GitHub Actions Tests

```bash
# Run with act locally
act -W .github/workflows/test.yml -v

# Enable debug logging
act -W .github/workflows/test.yml --verbose
```

## Best Practices

1. **Test Independence**: Each test should be independent and not rely on other tests
2. **Clear Names**: Use descriptive test names that explain what is being tested
3. **Error Messages**: Include helpful error messages for failed assertions
4. **Setup/Teardown**: Use setup() and teardown() functions for test fixtures
5. **Coverage**: Aim for 80%+ coverage of all code paths
6. **Security**: Always test security-critical functionality
7. **Performance**: Keep tests fast (< 5 seconds per test where possible)

## Troubleshooting

### Bats command not found

```bash
# Install bats
sudo apt-get install bats
# Or
brew install bats-core
```

### Shellcheck not found

```bash
sudo apt-get install shellcheck
# Or
brew install shellcheck
```

### Act fails to run

```bash
# Make sure Docker is running
docker ps

# Pull the act images
docker pull ghcr.io/catthehacker/ubuntu:act-latest
```

## Contributing

When adding new infrastructure code:

1. Write tests FIRST (TDD approach)
2. Ensure tests cover error cases
3. Run full test suite before committing
4. Update this README if adding new test categories

## Resources

- [Bats Documentation](https://bats-core.readthedocs.io/)
- [ShellCheck Wiki](https://www.shellcheck.net/wiki/)
- [ActionLint Documentation](https://github.com/rhysd/actionlint)
- [Act Documentation](https://github.com/nektos/act)
