# Test Master Plugin

A comprehensive testing and debugging toolkit for Claude Code that helps developers write better tests and debug failures faster.

## Features

### Commands

| Command | Description |
|---------|-------------|
| `/generate-tests` | Generate comprehensive unit tests for specified files or functions |
| `/debug-failure` | Analyze test failures and stack traces to identify root causes |

### Agents

| Agent | Description | When to Use |
|-------|-------------|-------------|
| `test-generator` | Expert test engineer that creates comprehensive, maintainable tests | When you need tests for new or existing code |
| `failure-debugger` | Test failure analyst that identifies root causes and suggests fixes | When tests are failing and you need help debugging |

## Usage Examples

### Generating Tests

```
/generate-tests

# Or invoke the agent directly
"Can you generate tests for the UserService class?"
"I need comprehensive tests for the auth module"
"Create tests for the validateEmail function"
```

The test-generator will:
1. Analyze your source code
2. Detect your testing framework
3. Follow your project's conventions
4. Generate tests covering happy paths, edge cases, and error conditions

### Debugging Failures

```
/debug-failure

# Or invoke the agent directly
"My tests started failing after the last commit"
"I'm getting 'expected undefined to equal object' - what does this mean?"
"This test is flaky and I can't figure out why"
```

The failure-debugger will:
1. Parse stack traces and error messages
2. Analyze the test and implementation code
3. Check recent changes that might have caused the issue
4. Provide specific fixes with before/after comparisons

## Test Generation Best Practices

The test-generator follows these principles:

- **DAMP over DRY**: Tests are Descriptive and Meaningful Phrases
- **AAA Pattern**: Arrange, Act, Assert structure
- **Single Responsibility**: Each test verifies one behavior
- **Independence**: Tests don't depend on each other
- **Framework Aware**: Uses your project's existing conventions

## Common Failure Patterns Detected

The failure-debugger recognizes and helps fix:

| Pattern | Symptoms | Typical Solution |
|---------|----------|------------------|
| Async/Timing | Intermittent failures | Add await, use waitFor |
| Mock Issues | Wrong return values | Verify mock configuration |
| State Leakage | Works alone, fails in suite | Add proper cleanup |
| Type Mismatch | Unexpected null/undefined | Add null checks |
| API Changes | Missing expected fields | Update test expectations |

## Supported Languages & Frameworks

- **JavaScript/TypeScript**: Jest, Vitest, Mocha, Jasmine
- **Python**: pytest, unittest
- **Go**: testing package
- **Rust**: built-in test framework

## Installation

This plugin is included in the Claude Code plugins directory. To use it:

1. Ensure Claude Code is installed
2. The plugin is automatically available via `/generate-tests` and `/debug-failure` commands
3. Agents can be invoked directly by asking for test generation or debugging help

## Contributing

Contributions are welcome! Please follow the standard plugin structure and include:
- Clear documentation
- Examples of usage
- Test coverage for any code changes
