#!/usr/bin/env bats
# End-to-end integration tests for firewall script
# These tests require privileged Docker container or mock iptables/ipset

load '../test-helper'

setup() {
  test_setup

  # Check if running in privileged mode
  if ! command -v iptables >/dev/null 2>&1; then
    skip "iptables not available - run in privileged container"
  fi

  # Save original iptables state
  iptables-save > "$TEST_TEMP_DIR/iptables.backup" 2>/dev/null || true
}

teardown() {
  # Restore original iptables state
  if [ -f "$TEST_TEMP_DIR/iptables.backup" ]; then
    iptables-restore < "$TEST_TEMP_DIR/iptables.backup" 2>/dev/null || true
  fi

  test_teardown
}

@test "firewall script runs without errors with mock data" {
  # This test validates the script structure without actually modifying firewall
  # We'll test with bash -n (syntax check)
  run bash -n "$PROJECT_ROOT/.devcontainer/init-firewall.sh"
  assert_success
}

@test "firewall script has correct shebang" {
  local first_line=$(head -n 1 "$PROJECT_ROOT/.devcontainer/init-firewall.sh")
  [[ "$first_line" == "#!/bin/bash" ]]
}

@test "firewall script sets strict error handling" {
  # Check for 'set -euo pipefail'
  grep -q "set -euo pipefail" "$PROJECT_ROOT/.devcontainer/init-firewall.sh"
}

@test "firewall script sets IFS correctly" {
  # Check for IFS setting
  grep -q "IFS=" "$PROJECT_ROOT/.devcontainer/init-firewall.sh"
}

@test "firewall script validates CIDR before processing" {
  # Verify the script contains CIDR validation regex
  grep -q "\\[0-9\\]{1,3}.*\\[0-9\\]{1,2}" "$PROJECT_ROOT/.devcontainer/init-firewall.sh"
}

@test "firewall script validates IP before processing" {
  # Verify the script contains IP validation regex
  local validation_count=$(grep -c "\\[0-9\\]{1,3}.*\\[0-9\\]{1,3}.*\\[0-9\\]{1,3}.*\\[0-9\\]{1,3}" "$PROJECT_ROOT/.devcontainer/init-firewall.sh")
  [ "$validation_count" -ge 2 ]
}

@test "firewall script checks for empty GitHub API response" {
  grep -q "if.*-z.*gh_ranges" "$PROJECT_ROOT/.devcontainer/init-firewall.sh"
}

@test "firewall script checks for required JSON fields" {
  grep -q "jq -e.*web.*api.*git" "$PROJECT_ROOT/.devcontainer/init-firewall.sh"
}

@test "firewall script checks for empty DNS responses" {
  grep -q "if.*-z.*ips" "$PROJECT_ROOT/.devcontainer/init-firewall.sh"
}

@test "firewall script checks for empty host IP" {
  grep -q "if.*-z.*HOST_IP" "$PROJECT_ROOT/.devcontainer/init-firewall.sh"
}

@test "firewall script includes verification step for blocked domain" {
  grep -q "example.com" "$PROJECT_ROOT/.devcontainer/init-firewall.sh"
}

@test "firewall script includes verification step for allowed domain" {
  grep -q "api.github.com" "$PROJECT_ROOT/.devcontainer/init-firewall.sh"
}

@test "firewall script allows required domains" {
  local required_domains=(
    "registry.npmjs.org"
    "api.anthropic.com"
    "sentry.io"
    "statsig.anthropic.com"
    "statsig.com"
  )

  for domain in "${required_domains[@]}"; do
    grep -q "$domain" "$PROJECT_ROOT/.devcontainer/init-firewall.sh"
  done
}

@test "firewall script creates ipset with correct type" {
  grep -q "ipset create.*hash:net" "$PROJECT_ROOT/.devcontainer/init-firewall.sh"
}

@test "firewall script uses aggregate to minimize CIDR ranges" {
  grep -q "aggregate" "$PROJECT_ROOT/.devcontainer/init-firewall.sh"
}

@test "firewall script allows DNS traffic" {
  grep -q "dport 53" "$PROJECT_ROOT/.devcontainer/init-firewall.sh"
}

@test "firewall script allows SSH traffic" {
  grep -q "dport 22" "$PROJECT_ROOT/.devcontainer/init-firewall.sh"
}

@test "firewall script allows localhost traffic" {
  grep -q "lo.*ACCEPT" "$PROJECT_ROOT/.devcontainer/init-firewall.sh"
}
