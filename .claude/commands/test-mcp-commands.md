---
allowed-tools: Bash
description: Test suite for MCP tool discovery commands
---

## Context

Automated tests for the new MCP tool discovery CLI commands to ensure they work correctly across different scenarios.

## Test Cases

### 1. Test `claude tools list` Command

```bash
# Test basic listing
claude tools list

# Test JSON output format
claude tools list --format json

# Test filtering by server
claude tools list --server github

# Test filtering by agent type
claude tools list --agent code-reviewer

# Test search functionality
claude tools list --search "issue"

# Test permission filtering
claude tools list --permissions read:repo

# Test combined filters
claude tools list --server github --search "update" --format json
```

Expected behaviors:
- Should list all available tools without invoking them
- Should support multiple output formats (human-readable, JSON, CSV)
- Should correctly filter tools based on criteria
- Should handle invalid filters gracefully

### 2. Test `claude tools inspect` Command

```bash
# Test inspecting a valid tool
claude tools inspect mcp__github__get_issue

# Test JSON output
claude tools inspect mcp__github__get_issue --json

# Test brief mode
claude tools inspect mcp__github__get_issue --brief

# Test inspecting non-existent tool
claude tools inspect mcp__nonexistent__tool

# Test inspecting multiple tools
claude tools inspect mcp__github__get_issue mcp__ide__getDiagnostics
```

Expected behaviors:
- Should display detailed information about specified tools
- Should handle non-existent tools gracefully with clear error messages
- Should support different output formats
- Should not invoke the tool being inspected

### 3. Test `claude mcp servers list` Command

```bash
# Test basic server listing
claude mcp servers list

# Test JSON format
claude mcp servers list --format json

# Test filtering by status
claude mcp servers list --status connected
claude mcp servers list --status disconnected

# Test verbose mode
claude mcp servers list --verbose

# Test sorting
claude mcp servers list --sort response_time
claude mcp servers list --sort tools

# Test watch mode (run for 5 seconds)
timeout 5 claude mcp servers list --watch

# Test alert mode
claude mcp servers list --alert
```

Expected behaviors:
- Should list all MCP servers with their status
- Should accurately report connection status and tool counts
- Should support real-time monitoring in watch mode
- Should highlight problematic servers in alert mode

### 4. Integration Tests

```bash
# Test command availability in help
claude --help | grep -E "(tools|mcp)"

# Test command aliases if any
claude tools ls  # Should work if 'ls' is alias for 'list'

# Test environment variable support
export CLAUDE_OUTPUT_FORMAT=json
claude tools list
unset CLAUDE_OUTPUT_FORMAT

# Test configuration file support
echo "output_format: json" > ~/.claude/config.yml
claude tools list
```

### 5. Error Handling Tests

```bash
# Test with invalid parameters
claude tools list --invalid-flag

# Test with conflicting options
claude tools list --format json --format csv

# Test with no MCP servers available
# (Simulate by disconnecting all servers if possible)

# Test rate limiting behavior
for i in {1..100}; do
  claude tools list --format json > /dev/null
done
```

### 6. Performance Tests

```bash
# Measure command execution time
time claude tools list

# Test with large number of tools
# (If environment has many tools available)

# Test caching behavior
claude tools list  # First run
claude tools list  # Should be faster if cached
```

### Test Validation Script

```bash
#!/bin/bash

# Run all tests and collect results
TESTS_PASSED=0
TESTS_FAILED=0

echo "Running MCP Command Tests..."

# Function to run test and check result
run_test() {
    local test_name="$1"
    local command="$2"
    
    echo -n "Testing: $test_name... "
    if eval "$command" > /dev/null 2>&1; then
        echo "✓ PASSED"
        ((TESTS_PASSED++))
    else
        echo "✗ FAILED"
        ((TESTS_FAILED++))
    fi
}

# Run test suite
run_test "Basic tools list" "claude tools list"
run_test "Tools list JSON" "claude tools list --format json"
run_test "Tools inspect" "claude tools inspect mcp__github__get_issue"
run_test "MCP servers list" "claude mcp servers list"

# Report results
echo ""
echo "Test Results:"
echo "  Passed: $TESTS_PASSED"
echo "  Failed: $TESTS_FAILED"

if [ $TESTS_FAILED -eq 0 ]; then
    echo "✓ All tests passed!"
    exit 0
else
    echo "✗ Some tests failed"
    exit 1
fi
```

## Acceptance Criteria Validation

- [ ] Commands work on macOS, Linux, and Windows
- [ ] Human-readable and JSON outputs are properly formatted
- [ ] Filtering options work correctly
- [ ] Commands do not invoke actual tools
- [ ] Permission models are respected
- [ ] Non-interactive mode works for CI/CD
- [ ] Commands enable shell completion
- [ ] Error messages are clear and helpful