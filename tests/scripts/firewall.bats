#!/usr/bin/env bats

# Test suite for .devcontainer/init-firewall.sh
# Tests IP validation, DNS resolution, iptables configuration, and error handling

setup() {
  # Load the firewall script for testing
  SCRIPT_DIR="${BATS_TEST_DIRNAME}/../../.devcontainer"
  FIREWALL_SCRIPT="${SCRIPT_DIR}/init-firewall.sh"

  # Create temp directory for test artifacts
  TEST_TEMP_DIR="$(mktemp -d)"
  export TEST_TEMP_DIR
}

teardown() {
  # Clean up temp directory
  if [ -n "$TEST_TEMP_DIR" ]; then
    rm -rf "$TEST_TEMP_DIR"
  fi
}

# Helper function to extract CIDR validation regex from script
get_cidr_validation_regex() {
  grep -oP '(?<=\[\[ ! "\$cidr" =~ ).*(?= \]\])' "$FIREWALL_SCRIPT"
}

# Helper function to extract IP validation regex from script
get_ip_validation_regex() {
  grep -oP '(?<=\[\[ ! "\$ip" =~ ).*(?= \]\])' "$FIREWALL_SCRIPT" | head -1
}

#
# CIDR Validation Tests
#

@test "CIDR validation: accepts valid CIDR range 192.168.1.0/24" {
  regex=$(get_cidr_validation_regex)
  cidr="192.168.1.0/24"
  [[ "$cidr" =~ $regex ]]
}

@test "CIDR validation: accepts valid CIDR range 10.0.0.0/8" {
  regex=$(get_cidr_validation_regex)
  cidr="10.0.0.0/8"
  [[ "$cidr" =~ $regex ]]
}

@test "CIDR validation: accepts valid CIDR range 172.16.0.0/12" {
  regex=$(get_cidr_validation_regex)
  cidr="172.16.0.0/12"
  [[ "$cidr" =~ $regex ]]
}

@test "CIDR validation: rejects invalid CIDR 999.999.999.999/99" {
  regex=$(get_cidr_validation_regex)
  cidr="999.999.999.999/99"
  ! [[ "$cidr" =~ $regex ]]
}

@test "CIDR validation: rejects CIDR without mask 192.168.1.1" {
  regex=$(get_cidr_validation_regex)
  cidr="192.168.1.1"
  ! [[ "$cidr" =~ $regex ]]
}

@test "CIDR validation: rejects invalid mask /33" {
  regex=$(get_cidr_validation_regex)
  cidr="192.168.1.0/33"
  ! [[ "$cidr" =~ $regex ]]
}

@test "CIDR validation: rejects malformed IP 192.168.1/24" {
  regex=$(get_cidr_validation_regex)
  cidr="192.168.1/24"
  ! [[ "$cidr" =~ $regex ]]
}

@test "CIDR validation: rejects alphabetic characters" {
  regex=$(get_cidr_validation_regex)
  cidr="abc.def.ghi.jkl/24"
  ! [[ "$cidr" =~ $regex ]]
}

#
# IP Address Validation Tests
#

@test "IP validation: accepts valid IP 192.168.1.1" {
  regex=$(get_ip_validation_regex)
  ip="192.168.1.1"
  [[ "$ip" =~ $regex ]]
}

@test "IP validation: accepts valid IP 10.0.0.1" {
  regex=$(get_ip_validation_regex)
  ip="10.0.0.1"
  [[ "$ip" =~ $regex ]]
}

@test "IP validation: accepts valid IP 255.255.255.255" {
  regex=$(get_ip_validation_regex)
  ip="255.255.255.255"
  [[ "$ip" =~ $regex ]]
}

@test "IP validation: rejects invalid IP 999.999.999.999" {
  regex=$(get_ip_validation_regex)
  ip="999.999.999.999"
  ! [[ "$ip" =~ $regex ]]
}

@test "IP validation: rejects incomplete IP 192.168.1" {
  regex=$(get_ip_validation_regex)
  ip="192.168.1"
  ! [[ "$ip" =~ $regex ]]
}

@test "IP validation: rejects IP with CIDR mask 192.168.1.1/24" {
  regex=$(get_ip_validation_regex)
  ip="192.168.1.1/24"
  ! [[ "$ip" =~ $regex ]]
}

@test "IP validation: rejects alphabetic characters" {
  regex=$(get_ip_validation_regex)
  ip="abc.def.ghi.jkl"
  ! [[ "$ip" =~ $regex ]]
}

#
# Script Structure Tests
#

@test "firewall script exists and is executable" {
  [ -f "$FIREWALL_SCRIPT" ]
  [ -x "$FIREWALL_SCRIPT" ]
}

@test "script contains required safety flags (set -euo pipefail)" {
  grep -q "set -euo pipefail" "$FIREWALL_SCRIPT"
}

@test "script validates GitHub API response structure" {
  grep -q "jq -e '\.web and \.api and \.git'" "$FIREWALL_SCRIPT"
}

@test "script checks for empty GitHub API response" {
  grep -q 'if \[ -z "\$gh_ranges" \]' "$FIREWALL_SCRIPT"
}

@test "script validates DNS resolution results" {
  grep -q 'if \[ -z "\$ips" \]' "$FIREWALL_SCRIPT"
}

@test "script includes firewall verification test" {
  grep -q "curl.*example.com" "$FIREWALL_SCRIPT"
}

@test "script verifies GitHub API access" {
  grep -q "curl.*api.github.com" "$FIREWALL_SCRIPT"
}

#
# Required Commands Tests
#

@test "script uses iptables for firewall rules" {
  grep -q "iptables" "$FIREWALL_SCRIPT"
}

@test "script uses ipset for IP range management" {
  grep -q "ipset" "$FIREWALL_SCRIPT"
}

@test "script uses curl for GitHub API" {
  grep -q "curl.*github.com/meta" "$FIREWALL_SCRIPT"
}

@test "script uses jq for JSON parsing" {
  grep -q "jq" "$FIREWALL_SCRIPT"
}

@test "script uses dig for DNS resolution" {
  grep -q "dig +short A" "$FIREWALL_SCRIPT"
}

@test "script uses aggregate for IP consolidation" {
  grep -q "aggregate -q" "$FIREWALL_SCRIPT"
}

#
# Security Configuration Tests
#

@test "script allows localhost traffic" {
  grep -q "iptables -A INPUT -i lo -j ACCEPT" "$FIREWALL_SCRIPT"
  grep -q "iptables -A OUTPUT -o lo -j ACCEPT" "$FIREWALL_SCRIPT"
}

@test "script allows DNS traffic" {
  grep -q "iptables -A OUTPUT -p udp --dport 53 -j ACCEPT" "$FIREWALL_SCRIPT"
  grep -q "iptables -A INPUT -p udp --sport 53 -j ACCEPT" "$FIREWALL_SCRIPT"
}

@test "script allows SSH traffic" {
  grep -q "iptables -A OUTPUT -p tcp --dport 22 -j ACCEPT" "$FIREWALL_SCRIPT"
}

@test "script sets default policy to DROP" {
  grep -q "iptables -P INPUT DROP" "$FIREWALL_SCRIPT"
  grep -q "iptables -P FORWARD DROP" "$FIREWALL_SCRIPT"
  grep -q "iptables -P OUTPUT DROP" "$FIREWALL_SCRIPT"
}

@test "script allows established connections" {
  grep -q "iptables -A INPUT -m state --state ESTABLISHED,RELATED -j ACCEPT" "$FIREWALL_SCRIPT"
  grep -q "iptables -A OUTPUT -m state --state ESTABLISHED,RELATED -j ACCEPT" "$FIREWALL_SCRIPT"
}

#
# Domain Allowlist Tests
#

@test "script includes registry.npmjs.org in allowlist" {
  grep -q "registry.npmjs.org" "$FIREWALL_SCRIPT"
}

@test "script includes api.anthropic.com in allowlist" {
  grep -q "api.anthropic.com" "$FIREWALL_SCRIPT"
}

@test "script includes GitHub domains via API" {
  grep -q "github.com/meta" "$FIREWALL_SCRIPT"
}

@test "script includes statsig domains" {
  grep -q "statsig" "$FIREWALL_SCRIPT"
}

#
# Error Handling Tests
#

@test "script has error message for GitHub API failure" {
  grep -q "ERROR.*Failed to fetch GitHub IP ranges" "$FIREWALL_SCRIPT"
}

@test "script has error message for missing API fields" {
  grep -q "ERROR.*GitHub API response missing required fields" "$FIREWALL_SCRIPT"
}

@test "script has error message for invalid CIDR" {
  grep -q "ERROR.*Invalid CIDR range" "$FIREWALL_SCRIPT"
}

@test "script has error message for DNS resolution failure" {
  grep -q "ERROR.*Failed to resolve" "$FIREWALL_SCRIPT"
}

@test "script has error message for invalid IP format" {
  grep -q "ERROR.*Invalid IP from DNS" "$FIREWALL_SCRIPT"
}

@test "script has error message for missing host IP" {
  grep -q "ERROR.*Failed to detect host IP" "$FIREWALL_SCRIPT"
}

#
# Cleanup and Idempotency Tests
#

@test "script flushes existing iptables rules" {
  grep -q "iptables -F" "$FIREWALL_SCRIPT"
  grep -q "iptables -X" "$FIREWALL_SCRIPT"
}

@test "script destroys existing ipsets before creating new ones" {
  grep -q "ipset destroy allowed-domains.*|| true" "$FIREWALL_SCRIPT"
}

@test "script creates ipset with correct type" {
  grep -q "ipset create allowed-domains hash:net" "$FIREWALL_SCRIPT"
}

#
# Verification Tests
#

@test "script verifies firewall blocks unauthorized domains" {
  grep -q "if curl.*example.com" "$FIREWALL_SCRIPT"
  grep -q "ERROR.*Firewall verification failed.*able to reach" "$FIREWALL_SCRIPT"
}

@test "script verifies GitHub API is accessible" {
  grep -q "if ! curl.*api.github.com/zen" "$FIREWALL_SCRIPT"
  grep -q "ERROR.*unable to reach.*api.github.com" "$FIREWALL_SCRIPT"
}

@test "script uses appropriate curl timeouts" {
  grep -q "curl --connect-timeout" "$FIREWALL_SCRIPT"
}
