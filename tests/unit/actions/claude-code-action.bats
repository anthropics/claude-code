#!/usr/bin/env bats
# Tests for claude-code-action validation logic

load '../../test-helper'

setup() {
  test_setup

  # Create test script that simulates the prompt validation logic
  cat > "$TEST_TEMP_DIR/validate-prompt.sh" << 'EOF'
#!/bin/bash

prompt="$1"
prompt_file="$2"

# Check if either prompt or prompt_file is provided
if [ -z "$prompt" ] && [ -z "$prompt_file" ]; then
  echo "::error::Neither 'prompt' nor 'prompt_file' was provided. At least one is required."
  exit 1
fi

# Determine which prompt source to use
if [ ! -z "$prompt_file" ]; then
  # Check if the prompt file exists
  if [ ! -f "$prompt_file" ]; then
    echo "::error::Prompt file '$prompt_file' does not exist."
    exit 1
  fi

  # Use the provided prompt file
  PROMPT_PATH="$prompt_file"
else
  PROMPT_PATH="/tmp/prompt.txt"
  echo "$prompt" > "$PROMPT_PATH"
fi

# Verify the prompt file is not empty
if [ ! -s "$PROMPT_PATH" ]; then
  echo "::error::Prompt is empty. Please provide a non-empty prompt."
  exit 1
fi

echo "PROMPT_PATH=$PROMPT_PATH"
exit 0
EOF

  chmod +x "$TEST_TEMP_DIR/validate-prompt.sh"
}

teardown() {
  test_teardown
}

@test "fails when both prompt and prompt_file are empty" {
  run "$TEST_TEMP_DIR/validate-prompt.sh" "" ""
  assert_failure
  assert_output_contains "Neither 'prompt' nor 'prompt_file' was provided"
}

@test "succeeds when prompt is provided" {
  run "$TEST_TEMP_DIR/validate-prompt.sh" "Test prompt" ""
  assert_success
  assert_output_contains "PROMPT_PATH="
}

@test "succeeds when prompt_file is provided and exists" {
  echo "Test content" > "$TEST_TEMP_DIR/test-prompt.txt"
  run "$TEST_TEMP_DIR/validate-prompt.sh" "" "$TEST_TEMP_DIR/test-prompt.txt"
  assert_success
  assert_output_contains "PROMPT_PATH="
}

@test "fails when prompt_file does not exist" {
  run "$TEST_TEMP_DIR/validate-prompt.sh" "" "/nonexistent/file.txt"
  assert_failure
  assert_output_contains "does not exist"
}

@test "fails when prompt is empty string" {
  run "$TEST_TEMP_DIR/validate-prompt.sh" "" ""
  assert_failure
}

@test "fails when prompt_file is empty file" {
  touch "$TEST_TEMP_DIR/empty-prompt.txt"
  run "$TEST_TEMP_DIR/validate-prompt.sh" "" "$TEST_TEMP_DIR/empty-prompt.txt"
  assert_failure
  assert_output_contains "Prompt is empty"
}

@test "prefers prompt_file over prompt when both provided" {
  echo "File content" > "$TEST_TEMP_DIR/priority-test.txt"
  run "$TEST_TEMP_DIR/validate-prompt.sh" "Prompt content" "$TEST_TEMP_DIR/priority-test.txt"
  assert_success
  assert_output_contains "$TEST_TEMP_DIR/priority-test.txt"
}

@test "handles prompt with special characters" {
  run "$TEST_TEMP_DIR/validate-prompt.sh" "Test with \$special &chars" ""
  assert_success
}

@test "handles multiline prompt" {
  run "$TEST_TEMP_DIR/validate-prompt.sh" "Line 1
Line 2
Line 3" ""
  assert_success
}

@test "handles very long prompt" {
  local long_prompt=$(printf 'a%.0s' {1..10000})
  run "$TEST_TEMP_DIR/validate-prompt.sh" "$long_prompt" ""
  assert_success
}
