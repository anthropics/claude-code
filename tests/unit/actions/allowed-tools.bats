#!/usr/bin/env bats
# Tests for allowed_tools parameter handling

load '../../test-helper'

setup() {
  test_setup

  # Create test script for allowed tools processing
  cat > "$TEST_TEMP_DIR/test-allowed-tools.sh" << 'EOF'
#!/bin/bash

allowed_tools="$1"

if [ -z "$allowed_tools" ]; then
  echo "No tools restriction"
  exit 0
fi

# Parse comma-separated tools
IFS=',' read -ra TOOLS <<< "$allowed_tools"

echo "Allowed tools:"
for tool in "${TOOLS[@]}"; do
  echo "  - $tool"
done

exit 0
EOF

  chmod +x "$TEST_TEMP_DIR/test-allowed-tools.sh"
}

teardown() {
  test_teardown
}

@test "empty allowed_tools means no restriction" {
  run "$TEST_TEMP_DIR/test-allowed-tools.sh" ""
  assert_success
  assert_output_contains "No tools restriction"
}

@test "single tool is parsed correctly" {
  run "$TEST_TEMP_DIR/test-allowed-tools.sh" "Bash"
  assert_success
  assert_output_contains "- Bash"
}

@test "multiple tools are parsed correctly" {
  run "$TEST_TEMP_DIR/test-allowed-tools.sh" "Bash,Read,Write"
  assert_success
  assert_output_contains "- Bash"
  assert_output_contains "- Read"
  assert_output_contains "- Write"
}

@test "handles tools with parentheses" {
  run "$TEST_TEMP_DIR/test-allowed-tools.sh" "Bash(gh label list)"
  assert_success
  assert_output_contains "Bash(gh label list)"
}

@test "handles MCP tool names" {
  run "$TEST_TEMP_DIR/test-allowed-tools.sh" "mcp__github__get_issue,mcp__github__update_issue"
  assert_success
  assert_output_contains "mcp__github__get_issue"
  assert_output_contains "mcp__github__update_issue"
}

@test "handles complex tool configuration from issue triage" {
  local tools="Bash(gh label list),mcp__github__get_issue,mcp__github__get_issue_comments,mcp__github__update_issue,mcp__github__search_issues,mcp__github__list_issues"
  run "$TEST_TEMP_DIR/test-allowed-tools.sh" "$tools"
  assert_success
  assert_output_contains "mcp__github__get_issue"
  assert_output_contains "mcp__github__update_issue"
}

@test "handles spaces in tool names" {
  run "$TEST_TEMP_DIR/test-allowed-tools.sh" "Tool One,Tool Two"
  assert_success
  assert_output_contains "Tool One"
  assert_output_contains "Tool Two"
}
