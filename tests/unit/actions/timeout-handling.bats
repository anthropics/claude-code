#!/usr/bin/env bats
# Tests for timeout handling in GitHub Actions

load '../../test-helper'

setup() {
  test_setup

  # Create test script that simulates timeout logic
  cat > "$TEST_TEMP_DIR/test-timeout.sh" << 'EOF'
#!/bin/bash

timeout_minutes="$1"

if [ -z "$timeout_minutes" ]; then
  timeout_minutes=10
fi

# Convert minutes to seconds
timeout_seconds=$((timeout_minutes * 60))

echo "Timeout set to $timeout_seconds seconds ($timeout_minutes minutes)"
exit 0
EOF

  chmod +x "$TEST_TEMP_DIR/test-timeout.sh"
}

teardown() {
  test_teardown
}

@test "default timeout is 10 minutes" {
  run "$TEST_TEMP_DIR/test-timeout.sh" ""
  assert_success
  assert_output_contains "600 seconds (10 minutes)"
}

@test "custom timeout is converted correctly" {
  run "$TEST_TEMP_DIR/test-timeout.sh" "5"
  assert_success
  assert_output_contains "300 seconds (5 minutes)"
}

@test "timeout handles single minute" {
  run "$TEST_TEMP_DIR/test-timeout.sh" "1"
  assert_success
  assert_output_contains "60 seconds (1 minutes)"
}

@test "timeout handles large values" {
  run "$TEST_TEMP_DIR/test-timeout.sh" "60"
  assert_success
  assert_output_contains "3600 seconds (60 minutes)"
}

@test "validates timeout calculation for various inputs" {
  local test_cases=(
    "1:60"
    "5:300"
    "10:600"
    "15:900"
    "30:1800"
  )

  for test_case in "${test_cases[@]}"; do
    IFS=':' read -r minutes expected_seconds <<< "$test_case"
    output=$("$TEST_TEMP_DIR/test-timeout.sh" "$minutes")
    [[ "$output" == *"$expected_seconds seconds"* ]]
  done
}
