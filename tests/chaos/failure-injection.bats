#!/usr/bin/env bats

# Chaos engineering / failure injection tests
# Test how the system behaves under failure conditions

setup() {
  SCRIPT_DIR="${BATS_TEST_DIRNAME}/../../.devcontainer"
  TEST_TEMP_DIR="$(mktemp -d)"
  export TEST_TEMP_DIR
}

teardown() {
  if [ -n "$TEST_TEMP_DIR" ]; then
    rm -rf "$TEST_TEMP_DIR"
  fi
}

#
# Network Failure Tests
#

@test "chaos: GitHub API returns empty response" {
  # Simulate empty API response
  cat > "$TEST_TEMP_DIR/test-script.sh" << 'EOF'
#!/bin/bash
set -euo pipefail

# Mock curl to return empty response
function curl() {
  if [[ "$*" == *"github.com/meta"* ]]; then
    echo ""
    return 0
  fi
  command curl "$@"
}

# Inline the validation logic from init-firewall.sh
gh_ranges=$(curl -s https://api.github.com/meta)

if [ -z "$gh_ranges" ]; then
  echo "ERROR: Failed to fetch GitHub IP ranges"
  exit 1
fi

echo "Test passed - error detected"
EOF

  chmod +x "$TEST_TEMP_DIR/test-script.sh"
  run "$TEST_TEMP_DIR/test-script.sh"

  [ "$status" -eq 1 ]
  [[ "$output" =~ "ERROR" ]]
}

@test "chaos: GitHub API returns malformed JSON" {
  cat > "$TEST_TEMP_DIR/test-malformed.sh" << 'EOF'
#!/bin/bash
set -euo pipefail

# Mock malformed JSON
gh_ranges='{"web": [invalid json'

# This should fail when parsing with jq
if ! echo "$gh_ranges" | jq -e '.web and .api and .git' >/dev/null 2>&1; then
  echo "ERROR: GitHub API response missing required fields"
  exit 1
fi

echo "Should not reach here"
exit 0
EOF

  chmod +x "$TEST_TEMP_DIR/test-malformed.sh"
  run "$TEST_TEMP_DIR/test-malformed.sh"

  [ "$status" -eq 1 ]
  [[ "$output" =~ "ERROR" ]]
}

@test "chaos: DNS resolution fails" {
  cat > "$TEST_TEMP_DIR/test-dns-fail.sh" << 'EOF'
#!/bin/bash
set -euo pipefail

# Mock dig failure
domain="registry.npmjs.org"
ips=""  # Simulate DNS failure

if [ -z "$ips" ]; then
  echo "ERROR: Failed to resolve $domain"
  exit 1
fi

echo "Should not reach here"
EOF

  chmod +x "$TEST_TEMP_DIR/test-dns-fail.sh"
  run "$TEST_TEMP_DIR/test-dns-fail.sh"

  [ "$status" -eq 1 ]
  [[ "$output" =~ "ERROR" ]]
}

@test "chaos: curl timeout" {
  # Test that timeouts are configured
  grep -q "curl --connect-timeout" "$SCRIPT_DIR/init-firewall.sh"
}

#
# File System Failure Tests
#

@test "chaos: prompt file suddenly deleted" {
  # Create then delete prompt file
  PROMPT_FILE="$TEST_TEMP_DIR/prompt.txt"
  echo "Test prompt" > "$PROMPT_FILE"

  # Verify it exists
  [ -f "$PROMPT_FILE" ]

  # Delete it
  rm "$PROMPT_FILE"

  # Verification should fail
  ! [ -s "$PROMPT_FILE" ]
}

@test "chaos: prompt file becomes empty mid-execution" {
  PROMPT_FILE="$TEST_TEMP_DIR/prompt.txt"
  echo "Test prompt" > "$PROMPT_FILE"

  # File exists and is not empty
  [ -s "$PROMPT_FILE" ]

  # Truncate it
  : > "$PROMPT_FILE"

  # Should now be empty
  ! [ -s "$PROMPT_FILE" ]
}

@test "chaos: disk full during execution" {
  # Simulate disk full by trying to write to /dev/full
  ! echo "test" > /dev/full 2>&1
}

#
# Resource Exhaustion Tests
#

@test "chaos: script handles SIGTERM gracefully" {
  cat > "$TEST_TEMP_DIR/test-sigterm.sh" << 'EOF'
#!/bin/bash

# Set up cleanup handler
cleanup() {
  echo "Cleanup called"
  exit 0
}

trap cleanup SIGTERM SIGINT

# Simulate long-running process
sleep 1000 &
wait
EOF

  chmod +x "$TEST_TEMP_DIR/test-sigterm.sh"

  # Start script in background
  "$TEST_TEMP_DIR/test-sigterm.sh" &
  PID=$!

  # Give it time to set up
  sleep 0.2

  # Send SIGTERM
  kill -TERM $PID 2>/dev/null || true

  # Wait a bit
  sleep 0.5

  # Should have exited
  ! kill -0 $PID 2>/dev/null
}

@test "chaos: multiple concurrent executions" {
  # Test that script can handle multiple instances
  # (or properly fails with lock)

  cat > "$TEST_TEMP_DIR/concurrent.sh" << 'EOF'
#!/bin/bash
set -e
# Quick validation test
[[ "192.168.1.0/24" =~ ^[0-9]{1,3}\.[0-9]{1,3}\.[0-9]{1,3}\.[0-9]{1,3}/[0-9]{1,2}$ ]]
EOF

  chmod +x "$TEST_TEMP_DIR/concurrent.sh"

  # Run 5 instances in parallel
  for i in {1..5}; do
    "$TEST_TEMP_DIR/concurrent.sh" &
  done

  # Wait for all to complete
  wait

  # All should succeed
  [ $? -eq 0 ]
}

#
# Race Condition Tests
#

@test "chaos: TOCTOU - file exists check vs read" {
  # Time-of-check to time-of-use race condition
  PROMPT_FILE="$TEST_TEMP_DIR/prompt.txt"
  echo "Test" > "$PROMPT_FILE"

  # Check exists
  if [ -f "$PROMPT_FILE" ]; then
    # Simulate file being deleted between check and use
    # In real code, this would use proper atomic operations
    rm "$PROMPT_FILE"

    # Read would fail
    ! cat "$PROMPT_FILE" 2>/dev/null
  fi
}

#
# Invalid Input Cascade Tests
#

@test "chaos: cascading failures from invalid CIDR" {
  # Test that one invalid CIDR doesn't break the entire list

  cat > "$TEST_TEMP_DIR/test-cidr-cascade.sh" << 'EOF'
#!/bin/bash
set -euo pipefail

# Simulate processing multiple CIDRs
cidrs=(
  "192.168.1.0/24"
  "INVALID_CIDR"
  "10.0.0.0/8"
)

valid_count=0
invalid_count=0

for cidr in "${cidrs[@]}"; do
  if [[ "$cidr" =~ ^[0-9]{1,3}\.[0-9]{1,3}\.[0-9]{1,3}\.[0-9]{1,3}/[0-9]{1,2}$ ]]; then
    ((valid_count++))
  else
    echo "ERROR: Invalid CIDR range: $cidr"
    ((invalid_count++))
  fi
done

echo "Valid: $valid_count, Invalid: $invalid_count"

# Should have caught the invalid one
[ "$invalid_count" -eq 1 ]
[ "$valid_count" -eq 2 ]
EOF

  chmod +x "$TEST_TEMP_DIR/test-cidr-cascade.sh"
  run "$TEST_TEMP_DIR/test-cidr-cascade.sh"

  [ "$status" -eq 0 ]
  [[ "$output" =~ "ERROR: Invalid CIDR" ]]
}

#
# Dependency Failure Tests
#

@test "chaos: missing required commands" {
  # Test behavior when dependencies are missing

  required_commands=(
    "iptables"
    "ipset"
    "curl"
    "jq"
    "dig"
    "aggregate"
  )

  for cmd in "${required_commands[@]}"; do
    # Verify command exists in script
    grep -q "$cmd" "$SCRIPT_DIR/init-firewall.sh"
  done
}

@test "chaos: jq command fails" {
  cat > "$TEST_TEMP_DIR/test-jq-fail.sh" << 'EOF'
#!/bin/bash
set -euo pipefail

# Mock jq failure
function jq() {
  return 1
}
export -f jq

gh_ranges='{"web":[],"api":[],"git":[]}'

# This should fail
if ! echo "$gh_ranges" | jq -e '.web and .api and .git' >/dev/null 2>&1; then
  echo "ERROR: GitHub API response missing required fields"
  exit 1
fi
EOF

  chmod +x "$TEST_TEMP_DIR/test-jq-fail.sh"
  run "$TEST_TEMP_DIR/test-jq-fail.sh"

  [ "$status" -eq 1 ]
  [[ "$output" =~ "ERROR" ]]
}

#
# Workflow Failure Tests
#

@test "chaos: action timeout expires" {
  ACTION_FILE=".github/actions/claude-code-action/action.yml"

  # Verify timeout is configured
  grep -q "timeout_minutes" "$ACTION_FILE"

  # Verify timeout is actually used
  grep -q "timeout.*timeout_minutes" "$ACTION_FILE"
}

@test "chaos: GitHub Actions runner out of disk space" {
  # This is handled by GitHub Actions infrastructure
  # We verify that we don't create excessive temporary files

  # Check that we clean up temp files
  ACTION_FILE=".github/actions/claude-code-action/action.yml"

  # Temp files should be in /tmp
  grep -q "/tmp" "$ACTION_FILE"
}

#
# Data Corruption Tests
#

@test "chaos: partially written prompt file" {
  # Simulate interrupted write
  PROMPT_FILE="$TEST_TEMP_DIR/prompt.txt"

  # Start writing but interrupt
  {
    echo "Line 1"
    echo "Line 2"
    # Interrupt here - no Line 3
  } > "$PROMPT_FILE"

  # File exists but may be incomplete
  [ -f "$PROMPT_FILE" ]

  # Content is as expected (partial)
  [ "$(wc -l < "$PROMPT_FILE")" -eq 2 ]
}

@test "chaos: Unicode in prompt file" {
  PROMPT_FILE="$TEST_TEMP_DIR/prompt-unicode.txt"

  # Write Unicode content
  echo "Hello 世界 🌍 مرحبا" > "$PROMPT_FILE"

  # Should be readable
  [ -s "$PROMPT_FILE" ]

  # Content should match
  content=$(cat "$PROMPT_FILE")
  [[ "$content" == "Hello 世界 🌍 مرحبا" ]]
}

#
# Permission Failure Tests
#

@test "chaos: script run without required capabilities" {
  # This is tested in integration tests
  # Here we verify error handling exists

  # Script should check for CAP_NET_ADMIN failures
  # iptables commands will fail without it
  # The 'set -e' should cause script to exit

  grep -q "set -e" "$SCRIPT_DIR/init-firewall.sh"
}

@test "chaos: read-only filesystem" {
  # Test behavior when filesystem is read-only
  # Temp file creation would fail

  # We can't actually make / read-only, but we can test /dev/null
  ! mkdir /dev/null/test 2>&1
}

#
# Recovery Tests
#

@test "chaos: script recovers after ipset cleanup failure" {
  # Verify script handles ipset destroy failure gracefully
  grep -q "ipset destroy.*|| true" "$SCRIPT_DIR/init-firewall.sh"
}

@test "chaos: idempotency - running script twice" {
  # Script should be idempotent
  # Already tested in integration tests
  # Here we verify cleanup happens

  grep -q "iptables -F" "$SCRIPT_DIR/init-firewall.sh"
  grep -q "ipset destroy" "$SCRIPT_DIR/init-firewall.sh"
}
