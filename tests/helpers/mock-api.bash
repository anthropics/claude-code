#!/bin/bash

# Mock API framework for testing
# Provides mock responses for external API calls

# Mock GitHub Meta API
mock_github_meta_api() {
  local variant="${1:-success}"

  case "$variant" in
    "success")
      cat << 'EOF'
{
  "verifiable_password_authentication": true,
  "web": ["192.30.252.0/22", "185.199.108.0/22", "140.82.112.0/20"],
  "api": ["192.30.252.0/22", "185.199.108.0/22", "140.82.112.0/20"],
  "git": ["192.30.252.0/22", "185.199.108.0/22", "140.82.112.0/20"],
  "hooks": ["192.30.252.0/22", "185.199.108.0/22", "140.82.112.0/20"],
  "packages": ["192.30.252.0/22", "185.199.108.0/22", "140.82.112.0/20"],
  "pages": ["185.199.108.0/22"]
}
EOF
      ;;
    "empty")
      echo ""
      ;;
    "malformed")
      echo '{"web": [invalid json'
      ;;
    "missing_fields")
      echo '{"web": ["192.30.252.0/22"]}'
      ;;
    "invalid_cidr")
      cat << 'EOF'
{
  "web": ["999.999.999.999/99"],
  "api": ["192.30.252.0/22"],
  "git": ["192.30.252.0/22"]
}
EOF
      ;;
    *)
      echo "Unknown variant: $variant" >&2
      return 1
      ;;
  esac
}

# Mock DNS resolution
mock_dns_lookup() {
  local domain="$1"
  local variant="${2:-success}"

  case "$variant" in
    "success")
      case "$domain" in
        "registry.npmjs.org")
          echo "104.16.16.35"
          echo "104.16.17.35"
          ;;
        "api.anthropic.com")
          echo "13.224.157.80"
          ;;
        "github.com")
          echo "140.82.121.4"
          ;;
        *)
          echo "192.0.2.1"  # TEST-NET-1
          ;;
      esac
      ;;
    "empty")
      echo ""
      ;;
    "invalid")
      echo "not.an.ip.address"
      ;;
    "timeout")
      sleep 10
      ;;
    *)
      echo "Unknown variant: $variant" >&2
      return 1
      ;;
  esac
}

# Mock curl command
mock_curl() {
  local url="$1"
  local variant="${2:-success}"

  case "$url" in
    *"github.com/meta"*)
      mock_github_meta_api "$variant"
      ;;
    *"api.github.com"*)
      if [ "$variant" == "timeout" ]; then
        sleep 10
        return 1
      fi
      echo '{"zen":"Design for failure."}'
      ;;
    *"example.com"*)
      if [ "$variant" == "blocked" ]; then
        return 1
      fi
      echo "<html>Example Domain</html>"
      ;;
    *)
      echo "Mock curl: unhandled URL: $url" >&2
      return 1
      ;;
  esac
}

# Mock dig command
mock_dig() {
  local domain=""
  local record_type="A"

  # Parse dig arguments
  while [[ $# -gt 0 ]]; do
    case "$1" in
      +short)
        # Just output IPs, no extra info
        shift
        ;;
      A|AAAA|MX|TXT)
        record_type="$1"
        shift
        ;;
      *)
        domain="$1"
        shift
        ;;
    esac
  done

  mock_dns_lookup "$domain" "${2:-success}"
}

# Mock iptables command (for testing without root)
mock_iptables() {
  echo "Mock iptables: $*" >&2
  return 0
}

# Mock ipset command (for testing without root)
mock_ipset() {
  local command="$1"

  case "$command" in
    "create")
      echo "Mock ipset create: $*" >&2
      ;;
    "add")
      echo "Mock ipset add: $*" >&2
      ;;
    "list")
      cat << 'EOF'
Name: allowed-domains
Type: hash:net
Revision: 6
Header: family inet hashsize 1024 maxelem 65536
Size in memory: 1024
References: 1
Number of entries: 10
Members:
192.30.252.0/22
185.199.108.0/22
140.82.112.0/20
EOF
      ;;
    "destroy")
      echo "Mock ipset destroy: $*" >&2
      ;;
    *)
      echo "Mock ipset: unknown command: $command" >&2
      return 1
      ;;
  esac

  return 0
}

# Function to inject mocks into environment
inject_mocks() {
  export -f mock_github_meta_api
  export -f mock_dns_lookup
  export -f mock_curl
  export -f mock_dig
  export -f mock_iptables
  export -f mock_ipset

  # Override commands with mocks
  alias curl='mock_curl'
  alias dig='mock_dig'
  alias iptables='mock_iptables'
  alias ipset='mock_ipset'
}

# Function to clear mocks
clear_mocks() {
  unalias curl 2>/dev/null || true
  unalias dig 2>/dev/null || true
  unalias iptables 2>/dev/null || true
  unalias ipset 2>/dev/null || true
}

# Export functions
export -f mock_github_meta_api
export -f mock_dns_lookup
export -f mock_curl
export -f mock_dig
export -f mock_iptables
export -f mock_ipset
export -f inject_mocks
export -f clear_mocks
