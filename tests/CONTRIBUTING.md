# Contributing to Tests

Thank you for contributing to the Claude Code test suite! This guide will help you write high-quality tests.

## Table of Contents

- [Getting Started](#getting-started)
- [Writing Tests](#writing-tests)
- [Test Standards](#test-standards)
- [Running Tests](#running-tests)
- [Submitting Changes](#submitting-changes)
- [Best Practices](#best-practices)

## Getting Started

### Prerequisites

```bash
# Install test dependencies
cd tests
./setup-bats.sh

# Verify installation
bats --version
shellcheck --version
```

### Repository Structure

```
tests/
├── unit/              # Unit tests (fast, isolated)
├── integration/       # Integration tests (slower, realistic)
├── fixtures/          # Mock data and test data
├── scripts/           # Helper scripts
├── benchmarks/        # Performance tests
└── docker/            # Docker test environment
```

## Writing Tests

### Creating a New Test File

```bash
# Choose the right location
tests/unit/           # For isolated unit tests
tests/integration/    # For end-to-end tests

# Name your file descriptively
component-name-feature.bats
```

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

@test "descriptive test name that explains what is being tested" {
  # Arrange
  local input="test-value"

  # Act
  run command_to_test "$input"

  # Assert
  assert_success
  assert_output_contains "expected-output"
}
```

## Test Standards

### 1. Naming Conventions

**Test Files**
- Use kebab-case: `cidr-validation.bats`
- Be descriptive: What component/feature is being tested?
- Group related tests in same file

**Test Names**
- Start with action verb: "validates", "rejects", "handles"
- Be specific: What exact behavior is tested?
- Include the input type: "valid CIDR", "empty string"

**Examples:**
```bash
# Good ✓
@test "validates CIDR notation with /24 prefix"
@test "rejects CIDR with invalid IP octets"
@test "handles empty DNS response gracefully"

# Bad ✗
@test "test1"
@test "cidr test"
@test "works"
```

### 2. Test Structure (AAA Pattern)

Use Arrange-Act-Assert pattern:

```bash
@test "example test following AAA pattern" {
  # Arrange - Setup test data
  local test_cidr="192.168.1.0/24"

  # Act - Execute the code under test
  run validate_cidr "$test_cidr"

  # Assert - Verify the results
  assert_success
  assert_output_contains "Valid"
}
```

### 3. One Assertion Per Test (Prefer)

```bash
# Good ✓ - Focused test
@test "accepts valid CIDR with /24" {
  run validate_cidr "192.168.1.0/24"
  assert_success
}

@test "accepts valid CIDR with /32" {
  run validate_cidr "192.168.1.1/32"
  assert_success
}

# Acceptable - Related assertions
@test "validates CIDR format correctly" {
  run validate_cidr "192.168.1.0/24"
  assert_success
  assert_output_contains "192.168.1.0/24"
}
```

### 4. Test Independence

Each test should be independent:

```bash
# Good ✓ - Independent tests
@test "test A" {
  local data="test"
  run command "$data"
  assert_success
}

@test "test B" {
  local data="test"  # Own setup
  run command "$data"
  assert_success
}

# Bad ✗ - Shared state
shared_data="test"  # Don't do this!

@test "test A" {
  run command "$shared_data"
}
```

### 5. Use Helper Functions

Available helpers from `test-helper.bash`:

```bash
# Setup/Teardown
test_setup()           # Initialize test environment
test_teardown()        # Clean up after tests

# Assertions
assert_success()       # Command succeeded (exit 0)
assert_failure()       # Command failed (exit non-zero)
assert_output_contains "text"   # Output contains substring
assert_output_equals "text"     # Output matches exactly

# Validation
validate_cidr "cidr"   # Validate CIDR format
validate_ip "ip"       # Validate IP format

# Mocks
mock_curl              # Mock curl commands
mock_dig               # Mock DNS resolution
mock_ipset             # Mock ipset commands
mock_iptables          # Mock iptables commands
```

## Test Categories

### Unit Tests

Fast, isolated tests of individual functions:

```bash
@test "CIDR validation rejects invalid octets" {
  run validate_cidr "256.168.1.0/24"
  assert_failure
}
```

**Guidelines:**
- No external dependencies
- Use mocks for external calls
- Fast execution (< 100ms)
- High volume (many edge cases)

### Integration Tests

Realistic tests of complete workflows:

```bash
@test "firewall script validates GitHub meta response" {
  # Uses actual script logic, may mock external APIs
  run bash .devcontainer/init-firewall.sh
  assert_success
}
```

**Guidelines:**
- Test realistic scenarios
- May use Docker for isolation
- Slower execution (< 5s each)
- Focus on critical paths

## Running Tests

### During Development

```bash
# Watch mode - auto-run on changes
npm run test:watch

# Single test file
bats tests/unit/firewall/cidr-validation.bats

# Single test (by line number)
bats tests/unit/firewall/cidr-validation.bats:15
```

### Before Committing

```bash
# Run all tests
npm run test:all

# Or use pre-commit hook
pre-commit run --all-files
```

### Performance Testing

```bash
# Check test execution time
time bats tests/unit/**/*.bats

# Run benchmarks
npm run benchmark
```

## Submitting Changes

### Checklist

- [ ] Tests are named descriptively
- [ ] Tests follow AAA pattern
- [ ] Tests are independent
- [ ] All tests pass locally
- [ ] New tests are documented (if complex)
- [ ] Updated relevant docs if needed
- [ ] Pre-commit hooks pass

### Commit Message Format

```
test: add validation for XYZ feature

- Add unit tests for ABC
- Add integration tests for DEF
- Update test fixtures for GHI

Covers edge cases:
- Empty input
- Invalid format
- Boundary conditions
```

### Pull Request Template

```markdown
## What This Changes

Brief description of test changes.

## Tests Added

- Unit tests for X (10 tests)
- Integration tests for Y (5 tests)

## Coverage Impact

- Before: 85%
- After: 90%

## How to Test

npm run test:all
```

## Best Practices

### 1. Test Edge Cases

```bash
# Normal case
@test "accepts valid input"

# Edge cases
@test "handles empty string"
@test "handles very long input"
@test "handles special characters"
@test "handles maximum value"
@test "handles minimum value"
```

### 2. Test Error Paths

```bash
@test "succeeds with valid data" {
  run process_data "valid"
  assert_success
}

@test "fails gracefully with invalid data" {
  run process_data "invalid"
  assert_failure
  assert_output_contains "ERROR"
}
```

### 3. Use Descriptive Variables

```bash
# Good ✓
@test "validates IPv4 CIDR notation" {
  local valid_cidr="192.168.1.0/24"
  local invalid_cidr="not-a-cidr"

  run validate_cidr "$valid_cidr"
  assert_success
}

# Bad ✗
@test "test" {
  local x="192.168.1.0/24"
  run validate_cidr "$x"
}
```

### 4. Add Comments for Complex Logic

```bash
@test "handles complex scenario" {
  # Setup: Create a mock GitHub API response with multiple IP ranges
  local mock_response=$(cat tests/fixtures/github-meta-response.json)

  # Act: Process the response through the aggregation logic
  run process_github_ranges "$mock_response"

  # Assert: Verify all ranges are aggregated correctly
  assert_success
  assert_output_contains "192.30.252.0/22"
}
```

### 5. Keep Tests Maintainable

```bash
# Extract common setup to helper functions
validate_cidr_test() {
  local cidr="$1"
  run validate_cidr "$cidr"
}

@test "validates multiple CIDR formats" {
  validate_cidr_test "192.168.1.0/24"
  assert_success

  validate_cidr_test "10.0.0.0/8"
  assert_success
}
```

## Common Patterns

### Testing Command Line Tools

```bash
@test "CLI tool accepts --help flag" {
  run my-tool --help
  assert_success
  assert_output_contains "Usage:"
}
```

### Testing File Operations

```bash
@test "creates file with correct content" {
  local test_file="$TEST_TEMP_DIR/test.txt"

  run create_file "$test_file" "content"
  assert_success

  [ -f "$test_file" ]
  [ "$(cat "$test_file")" = "content" ]
}
```

### Testing Error Messages

```bash
@test "shows helpful error message" {
  run validate_input ""
  assert_failure
  assert_output_contains "ERROR: Input cannot be empty"
}
```

### Testing With Fixtures

```bash
@test "processes JSON correctly" {
  local fixture="$FIXTURES_DIR/sample.json"

  run process_json "$fixture"
  assert_success
}
```

## Performance Guidelines

### Unit Tests
- Target: < 100ms per test
- Use mocks for external calls
- Avoid file I/O when possible

### Integration Tests
- Target: < 5s per test
- Use Docker for isolation when needed
- Cache expensive setup

### Benchmarks
- Document baseline performance
- Track regressions
- Run separately from regular tests

## Code Review Guidelines

When reviewing test contributions:

1. **Clarity**: Are test names descriptive?
2. **Coverage**: Do tests cover edge cases?
3. **Independence**: Can tests run in any order?
4. **Performance**: Are tests reasonably fast?
5. **Maintainability**: Will these tests be easy to update?

## Getting Help

- Read existing tests for examples
- Check [tests/README.md](README.md) for documentation
- Ask questions in issues/PRs
- Reference [tests/ADVANCED.md](ADVANCED.md) for advanced patterns

## Examples

See these files for good examples:

- `tests/unit/firewall/cidr-validation.bats` - Edge case testing
- `tests/unit/actions/claude-code-action.bats` - Input validation
- `tests/integration/devcontainer/devcontainer-build.bats` - Integration tests

Thank you for contributing! 🎉
