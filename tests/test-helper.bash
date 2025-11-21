#!/usr/bin/env bash
# Test helper functions for bats tests

# Get the directory where this script is located
TEST_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
PROJECT_ROOT="$(cd "$TEST_DIR/.." && pwd)"
FIXTURES_DIR="$TEST_DIR/fixtures"

# Mock curl command for testing
mock_curl() {
  local url="$1"

  if [[ "$url" == *"api.github.com/meta"* ]]; then
    cat "$FIXTURES_DIR/github-meta-response.json"
    return 0
  elif [[ "$url" == *"example.com"* ]]; then
    # Simulate blocked domain
    return 1
  else
    # Default success for other URLs
    echo '{"status": "ok"}'
    return 0
  fi
}

# Mock dig command for testing
mock_dig() {
  local domain="$2"  # dig format: dig +short A domain.com

  # Read from mock DNS responses file
  if [ -f "$FIXTURES_DIR/mock-dns-responses.txt" ]; then
    local response=$(grep "^${domain}=" "$FIXTURES_DIR/mock-dns-responses.txt" | cut -d= -f2)
    if [ -n "$response" ]; then
      if [ "$response" = "TIMEOUT" ]; then
        return 1
      fi
      echo "$response" | tr ',' '\n'
      return 0
    fi
  fi

  # Default response for unknown domains
  echo "127.0.0.1"
  return 0
}

# Mock ipset command for testing
mock_ipset() {
  echo "ipset: $*" >&2
  return 0
}

# Mock iptables command for testing
mock_iptables() {
  echo "iptables: $*" >&2
  return 0
}

# Validate CIDR format (extracted from init-firewall.sh logic)
validate_cidr() {
  local cidr="$1"
  if [[ "$cidr" =~ ^[0-9]{1,3}\.[0-9]{1,3}\.[0-9]{1,3}\.[0-9]{1,3}/[0-9]{1,2}$ ]]; then
    return 0
  else
    return 1
  fi
}

# Validate IP format (extracted from init-firewall.sh logic)
validate_ip() {
  local ip="$1"
  if [[ "$ip" =~ ^[0-9]{1,3}\.[0-9]{1,3}\.[0-9]{1,3}\.[0-9]{1,3}$ ]]; then
    return 0
  else
    return 1
  fi
}

# Setup function to be called in setup() of tests
test_setup() {
  # Create temporary directory for test artifacts
  export TEST_TEMP_DIR="$(mktemp -d)"

  # Export mock functions
  export -f mock_curl
  export -f mock_dig
  export -f mock_ipset
  export -f mock_iptables
}

# Teardown function to be called in teardown() of tests
test_teardown() {
  # Clean up temporary directory
  if [ -n "$TEST_TEMP_DIR" ] && [ -d "$TEST_TEMP_DIR" ]; then
    rm -rf "$TEST_TEMP_DIR"
  fi
}

# Assert that a command succeeded
assert_success() {
  if [ "$status" -ne 0 ]; then
    echo "Expected success but got status $status"
    echo "Output: $output"
    return 1
  fi
}

# Assert that a command failed
assert_failure() {
  if [ "$status" -eq 0 ]; then
    echo "Expected failure but command succeeded"
    echo "Output: $output"
    return 1
  fi
}

# Assert that output contains a string
assert_output_contains() {
  local expected="$1"
  if [[ ! "$output" =~ $expected ]]; then
    echo "Expected output to contain: $expected"
    echo "Actual output: $output"
    return 1
  fi
}

# Assert that output matches exactly
assert_output_equals() {
  local expected="$1"
  if [ "$output" != "$expected" ]; then
    echo "Expected output: $expected"
    echo "Actual output: $output"
    return 1
  fi
}
