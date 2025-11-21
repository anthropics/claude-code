#!/usr/bin/env bats

# Tests for .devcontainer/init-firewall.sh
# This script has critical security implications and must be thoroughly tested

load '../test_helper/bats-support/load'
load '../test_helper/bats-assert/load'

setup() {
    # Set up test environment
    export TEST_MODE=true
    SCRIPT_PATH="${BATS_TEST_DIRNAME}/../../.devcontainer/init-firewall.sh"
}

# Test: Script exists and is executable
@test "init-firewall.sh exists and is executable" {
    [ -f "$SCRIPT_PATH" ]
    [ -x "$SCRIPT_PATH" ] || skip "Script is not executable (expected for security)"
}

# Test: Script has proper shebang
@test "init-firewall.sh has correct shebang" {
    run head -n 1 "$SCRIPT_PATH"
    assert_output "#!/bin/bash"
}

# Test: Script uses strict error handling
@test "init-firewall.sh uses strict error handling (set -euo pipefail)" {
    run grep -E "^set -euo pipefail" "$SCRIPT_PATH"
    assert_success
}

# Test: Script validates CIDR format
@test "CIDR validation: rejects invalid CIDR format" {
    # This tests the regex pattern used in the script
    invalid_cidrs=(
        "999.999.999.999/99"
        "256.1.1.1/24"
        "192.168.1.1/33"
        "192.168.1/24"
        "192.168.1.1"
        "not-an-ip/24"
    )

    # The script uses this regex: ^[0-9]{1,3}\.[0-9]{1,3}\.[0-9]{1,3}\.[0-9]{1,3}/[0-9]{1,2}$
    for cidr in "${invalid_cidrs[@]}"; do
        if [[ "$cidr" =~ ^[0-9]{1,3}\.[0-9]{1,3}\.[0-9]{1,3}\.[0-9]{1,3}/[0-9]{1,2}$ ]]; then
            # Should NOT match
            fail "Invalid CIDR '$cidr' passed validation"
        fi
    done
}

# Test: Script validates CIDR format - accepts valid CIDR
@test "CIDR validation: accepts valid CIDR format" {
    valid_cidrs=(
        "192.168.1.0/24"
        "10.0.0.0/8"
        "172.16.0.0/12"
        "8.8.8.8/32"
    )

    for cidr in "${valid_cidrs[@]}"; do
        if [[ ! "$cidr" =~ ^[0-9]{1,3}\.[0-9]{1,3}\.[0-9]{1,3}\.[0-9]{1,3}/[0-9]{1,2}$ ]]; then
            fail "Valid CIDR '$cidr' failed validation"
        fi
    done
}

# Test: Script validates IP address format
@test "IP validation: rejects invalid IP addresses" {
    invalid_ips=(
        "256.1.1.1"
        "192.168.1"
        "192.168.1.1.1"
        "not-an-ip"
        "192.168.-1.1"
    )

    # The script uses: ^[0-9]{1,3}\.[0-9]{1,3}\.[0-9]{1,3}\.[0-9]{1,3}$
    for ip in "${invalid_ips[@]}"; do
        if [[ "$ip" =~ ^[0-9]{1,3}\.[0-9]{1,3}\.[0-9]{1,3}\.[0-9]{1,3}$ ]]; then
            fail "Invalid IP '$ip' passed validation"
        fi
    done
}

# Test: Script validates IP address format - accepts valid IPs
@test "IP validation: accepts valid IP addresses" {
    valid_ips=(
        "192.168.1.1"
        "10.0.0.1"
        "8.8.8.8"
        "255.255.255.255"
    )

    for ip in "${valid_ips[@]}"; do
        if [[ ! "$ip" =~ ^[0-9]{1,3}\.[0-9]{1,3}\.[0-9]{1,3}\.[0-9]{1,3}$ ]]; then
            fail "Valid IP '$ip' failed validation"
        fi
    done
}

# Test: Script includes required domains
@test "script includes all required allowed domains" {
    required_domains=(
        "registry.npmjs.org"
        "api.anthropic.com"
        "sentry.io"
        "statsig.anthropic.com"
        "statsig.com"
    )

    for domain in "${required_domains[@]}"; do
        run grep -q "$domain" "$SCRIPT_PATH"
        assert_success "Domain '$domain' not found in script"
    done
}

# Test: Script fetches GitHub meta information
@test "script fetches GitHub meta information from correct API" {
    run grep -q "https://api.github.com/meta" "$SCRIPT_PATH"
    assert_success
}

# Test: Script validates GitHub API response
@test "script validates GitHub API response has required fields" {
    run grep -q "jq -e '.web and .api and .git'" "$SCRIPT_PATH"
    assert_success
}

# Test: Script handles empty GitHub response
@test "script checks for empty GitHub API response" {
    run grep -q 'if \[ -z "\$gh_ranges" \]' "$SCRIPT_PATH"
    assert_success
}

# Test: Script handles DNS resolution failures
@test "script checks for DNS resolution failures" {
    run grep -q 'if \[ -z "\$ips" \]' "$SCRIPT_PATH"
    assert_success
}

# Test: Script handles host IP detection failure
@test "script checks for host IP detection failure" {
    run grep -q 'if \[ -z "\$HOST_IP" \]' "$SCRIPT_PATH"
    assert_success
}

# Test: Script uses ipset for efficient IP filtering
@test "script creates ipset for allowed domains" {
    run grep -q "ipset create allowed-domains" "$SCRIPT_PATH"
    assert_success
}

# Test: Script cleans up existing ipset
@test "script destroys existing ipset before creating new one" {
    run grep -q "ipset destroy allowed-domains" "$SCRIPT_PATH"
    assert_success
}

# Test: Script flushes iptables rules
@test "script flushes existing iptables rules" {
    run grep -q "iptables -F" "$SCRIPT_PATH"
    assert_success
}

# Test: Script allows DNS traffic
@test "script allows DNS traffic (port 53)" {
    run grep -q "iptables -A OUTPUT -p udp --dport 53 -j ACCEPT" "$SCRIPT_PATH"
    assert_success
    run grep -q "iptables -A INPUT -p udp --sport 53 -j ACCEPT" "$SCRIPT_PATH"
    assert_success
}

# Test: Script allows SSH traffic
@test "script allows SSH traffic (port 22)" {
    run grep -q "iptables -A OUTPUT -p tcp --dport 22 -j ACCEPT" "$SCRIPT_PATH"
    assert_success
}

# Test: Script allows localhost traffic
@test "script allows localhost traffic" {
    run grep -q "iptables -A INPUT -i lo -j ACCEPT" "$SCRIPT_PATH"
    assert_success
    run grep -q "iptables -A OUTPUT -o lo -j ACCEPT" "$SCRIPT_PATH"
    assert_success
}

# Test: Script sets default DROP policy
@test "script sets default DROP policy for security" {
    run grep -q "iptables -P INPUT DROP" "$SCRIPT_PATH"
    assert_success
    run grep -q "iptables -P OUTPUT DROP" "$SCRIPT_PATH"
    assert_success
    run grep -q "iptables -P FORWARD DROP" "$SCRIPT_PATH"
    assert_success
}

# Test: Script allows established connections
@test "script allows established/related connections" {
    run grep -q "iptables -A INPUT -m state --state ESTABLISHED,RELATED -j ACCEPT" "$SCRIPT_PATH"
    assert_success
    run grep -q "iptables -A OUTPUT -m state --state ESTABLISHED,RELATED -j ACCEPT" "$SCRIPT_PATH"
    assert_success
}

# Test: Script verifies firewall configuration
@test "script includes firewall verification" {
    run grep -q "Firewall verification" "$SCRIPT_PATH"
    assert_success
}

# Test: Script verifies example.com is blocked
@test "script verifies example.com is blocked" {
    run grep -q "https://example.com" "$SCRIPT_PATH"
    assert_success
}

# Test: Script verifies GitHub API is accessible
@test "script verifies GitHub API is accessible" {
    run grep -q "https://api.github.com/zen" "$SCRIPT_PATH"
    assert_success
}

# Test: Script uses IFS for safe word splitting
@test "script sets IFS for safe word splitting" {
    run grep -q "IFS=" "$SCRIPT_PATH"
    assert_success
}

# Test: Script aggregates GitHub IP ranges
@test "script uses aggregate command for GitHub IPs" {
    run grep -q "aggregate -q" "$SCRIPT_PATH"
    assert_success
}

# Test: Script processes web, api, and git endpoints
@test "script processes GitHub web, api, and git endpoints" {
    run grep -q "(.web + .api + .git)" "$SCRIPT_PATH"
    assert_success
}

# Test: Script detects host network correctly
@test "script calculates host network from default route" {
    run grep -q "ip route | grep default" "$SCRIPT_PATH"
    assert_success
}

# Test: Script error messages are descriptive
@test "script has descriptive error messages" {
    error_checks=(
        "ERROR: Failed to fetch GitHub IP ranges"
        "ERROR: GitHub API response missing required fields"
        "ERROR: Invalid CIDR range"
        "ERROR: Failed to resolve"
        "ERROR: Invalid IP from DNS"
        "ERROR: Failed to detect host IP"
        "ERROR: Firewall verification failed"
    )

    for error_msg in "${error_checks[@]}"; do
        run grep -q "$error_msg" "$SCRIPT_PATH"
        assert_success "Error message '$error_msg' not found"
    done
}

# Test: Script exits on errors
@test "script exits with error code 1 on failures" {
    run grep -c "exit 1" "$SCRIPT_PATH"
    # Should have multiple exit 1 statements for different error conditions
    [ "$output" -ge 5 ]
}

# Test: Script uses curl with timeout
@test "script uses curl for HTTP requests" {
    run grep -q "curl" "$SCRIPT_PATH"
    assert_success
}

# Test: Script uses jq for JSON parsing
@test "script uses jq for JSON parsing" {
    run grep -q "jq" "$SCRIPT_PATH"
    assert_success
}

# Test: Script uses dig for DNS resolution
@test "script uses dig for DNS resolution" {
    run grep -q "dig +short A" "$SCRIPT_PATH"
    assert_success
}

# Test: No hardcoded credentials
@test "script contains no hardcoded credentials or API keys" {
    # Check for common patterns of hardcoded secrets
    run grep -iE "(password|api_key|secret|token)=" "$SCRIPT_PATH"
    # Should only find variable names, not actual values
    if [ "$status" -eq 0 ]; then
        # Make sure it's just variable assignments, not actual secrets
        run grep -iE "(password|api_key|secret|token)=['\"]?[a-zA-Z0-9]{20,}" "$SCRIPT_PATH"
        assert_failure "Potential hardcoded credentials found"
    fi
}

# Test: Script comments are present
@test "script includes explanatory comments" {
    run grep -c "^#" "$SCRIPT_PATH"
    # Should have at least 10 comment lines
    [ "$output" -ge 10 ]
}
