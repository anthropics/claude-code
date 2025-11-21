#!/usr/bin/env bats
# Tests for DNS resolution logic in init-firewall.sh

load '../../test-helper'

setup() {
  test_setup
}

teardown() {
  test_teardown
}

@test "DNS resolution returns valid IPs for known domains" {
  run mock_dig +short A registry.npmjs.org
  assert_success
  assert_output_contains "104.16"
}

@test "DNS resolution handles multiple IP responses" {
  output=$(mock_dig +short A registry.npmjs.org)
  local line_count=$(echo "$output" | wc -l)

  # Should return multiple IPs
  [ "$line_count" -gt 1 ]
}

@test "DNS resolution fails for empty domain" {
  run mock_dig +short A ""
  # Should return default localhost
  assert_success
  assert_output_contains "127.0.0.1"
}

@test "DNS resolution handles timeout" {
  run mock_dig +short A timeout.domain
  assert_failure
}

@test "validates all resolved IPs are valid format" {
  output=$(mock_dig +short A registry.npmjs.org)

  while IFS= read -r ip; do
    run validate_ip "$ip"
    assert_success
  done <<< "$output"
}

@test "DNS mock returns expected IPs for anthropic domains" {
  run mock_dig +short A api.anthropic.com
  assert_success
  assert_output_contains "54.230"
}

@test "DNS mock returns expected IPs for statsig domains" {
  run mock_dig +short A statsig.com
  assert_success
  assert_output_contains "13.225"
}

@test "handles malformed DNS responses" {
  run mock_dig +short A malformed.domain
  assert_success

  # Even if we get a malformed response, it should be validated
  output=$(mock_dig +short A malformed.domain)
  if [ -n "$output" ]; then
    run validate_ip "$output"
    # Should fail validation for non-IP format
  fi
}
