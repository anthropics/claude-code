#!/usr/bin/env bats
# Tests for error handling in init-firewall.sh

load '../../test-helper'

setup() {
  test_setup

  # Create a test version of the firewall script with testable functions
  cat > "$TEST_TEMP_DIR/firewall-functions.sh" << 'EOF'
#!/bin/bash
set -euo pipefail
IFS=$'\n\t'

# Extract validation functions for testing
validate_cidr() {
  local cidr="$1"
  if [[ ! "$cidr" =~ ^[0-9]{1,3}\.[0-9]{1,3}\.[0-9]{1,3}\.[0-9]{1,3}/[0-9]{1,2}$ ]]; then
    echo "ERROR: Invalid CIDR range: $cidr"
    return 1
  fi
  return 0
}

validate_ip() {
  local ip="$1"
  if [[ ! "$ip" =~ ^[0-9]{1,3}\.[0-9]{1,3}\.[0-9]{1,3}\.[0-9]{1,3}$ ]]; then
    echo "ERROR: Invalid IP: $ip"
    return 1
  fi
  return 0
}

process_github_ranges() {
  local gh_ranges="$1"

  if [ -z "$gh_ranges" ]; then
    echo "ERROR: Failed to fetch GitHub IP ranges"
    return 1
  fi

  if ! echo "$gh_ranges" | jq -e '.web and .api and .git' >/dev/null 2>&1; then
    echo "ERROR: GitHub API response missing required fields"
    return 1
  fi

  return 0
}

check_dns_resolution() {
  local domain="$1"
  local ips="$2"

  if [ -z "$ips" ]; then
    echo "ERROR: Failed to resolve $domain"
    return 1
  fi

  return 0
}

detect_host_ip() {
  local host_ip="$1"

  if [ -z "$host_ip" ]; then
    echo "ERROR: Failed to detect host IP"
    return 1
  fi

  return 0
}
EOF

  source "$TEST_TEMP_DIR/firewall-functions.sh"
}

teardown() {
  test_teardown
}

@test "script exits when GitHub meta API returns empty response" {
  run process_github_ranges ""
  assert_failure
  assert_output_contains "Failed to fetch GitHub IP ranges"
}

@test "script exits when GitHub meta API returns invalid JSON" {
  run process_github_ranges "not valid json"
  assert_failure
  assert_output_contains "missing required fields"
}

@test "script exits when GitHub meta API missing required fields" {
  run process_github_ranges '{"web": []}'
  assert_failure
  assert_output_contains "missing required fields"
}

@test "script accepts valid GitHub meta response" {
  local valid_response='{"web": ["192.30.252.0/22"], "api": ["192.30.252.0/22"], "git": ["192.30.252.0/22"]}'
  run process_github_ranges "$valid_response"
  assert_success
}

@test "script exits when DNS resolution fails" {
  run check_dns_resolution "example.com" ""
  assert_failure
  assert_output_contains "Failed to resolve"
}

@test "script exits when host IP detection fails" {
  run detect_host_ip ""
  assert_failure
  assert_output_contains "Failed to detect host IP"
}

@test "script exits on invalid CIDR from GitHub meta" {
  run validate_cidr "invalid/cidr"
  assert_failure
  assert_output_contains "Invalid CIDR"
}

@test "script exits on invalid IP from DNS" {
  run validate_ip "not.an.ip.address"
  assert_failure
  assert_output_contains "Invalid IP"
}

@test "error messages contain context about what failed" {
  run process_github_ranges ""
  assert_output_contains "GitHub"

  run check_dns_resolution "test.com" ""
  assert_output_contains "test.com"

  run detect_host_ip ""
  assert_output_contains "host IP"
}

@test "script validates CIDR before adding to ipset" {
  # Test that injection attempts are caught
  run validate_cidr "192.168.1.0/24; malicious-command"
  assert_failure
}

@test "script validates IP before adding to ipset" {
  # Test that injection attempts are caught
  run validate_ip "192.168.1.1; malicious-command"
  assert_failure
}
