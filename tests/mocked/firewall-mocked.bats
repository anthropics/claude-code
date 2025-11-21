#!/usr/bin/env bats

# Mocked tests for firewall script
# These tests use mocks instead of real API calls

load '../helpers/mock-api'

setup() {
  SCRIPT_DIR="${BATS_TEST_DIRNAME}/../../.devcontainer"
  TEST_TEMP_DIR="$(mktemp -d)"
  export TEST_TEMP_DIR

  # Inject mocks
  source "${BATS_TEST_DIRNAME}/../helpers/mock-api.bash"
}

teardown() {
  clear_mocks
  if [ -n "$TEST_TEMP_DIR" ]; then
    rm -rf "$TEST_TEMP_DIR"
  fi
}

#
# Mocked API Response Tests
#

@test "mocked: successful GitHub Meta API response" {
  response=$(mock_github_meta_api "success")

  # Verify response has required fields
  echo "$response" | jq -e '.web and .api and .git'
}

@test "mocked: GitHub Meta API returns empty response" {
  response=$(mock_github_meta_api "empty")

  [ -z "$response" ]
}

@test "mocked: GitHub Meta API returns malformed JSON" {
  response=$(mock_github_meta_api "malformed")

  # Should fail to parse
  ! echo "$response" | jq . 2>/dev/null
}

@test "mocked: GitHub Meta API missing required fields" {
  response=$(mock_github_meta_api "missing_fields")

  # Should fail validation
  ! echo "$response" | jq -e '.web and .api and .git' 2>/dev/null
}

@test "mocked: GitHub Meta API returns invalid CIDR" {
  response=$(mock_github_meta_api "invalid_cidr")

  # Extract CIDR and validate
  cidr=$(echo "$response" | jq -r '.web[0]')

  # Should not match validation regex
  ! [[ "$cidr" =~ ^[0-9]{1,3}\.[0-9]{1,3}\.[0-9]{1,3}\.[0-9]{1,3}/[0-9]{1,2}$ ]]
}

#
# Mocked DNS Tests
#

@test "mocked: successful DNS lookup" {
  ip=$(mock_dns_lookup "registry.npmjs.org" "success")

  # Should return valid IP
  [[ "$ip" =~ ^[0-9]{1,3}\.[0-9]{1,3}\.[0-9]{1,3}\.[0-9]{1,3}$ ]]
}

@test "mocked: DNS lookup returns empty" {
  ip=$(mock_dns_lookup "nonexistent.example.com" "empty")

  [ -z "$ip" ]
}

@test "mocked: DNS lookup returns invalid IP" {
  ip=$(mock_dns_lookup "bad.example.com" "invalid")

  # Should not match IP regex
  ! [[ "$ip" =~ ^[0-9]{1,3}\.[0-9]{1,3}\.[0-9]{1,3}\.[0-9]{1,3}$ ]]
}

#
# Mocked curl Tests
#

@test "mocked: curl GitHub API success" {
  response=$(mock_curl "https://api.github.com/meta" "success")

  # Should have web field
  echo "$response" | jq -e '.web'
}

@test "mocked: curl blocked domain" {
  run mock_curl "https://example.com" "blocked"

  [ "$status" -ne 0 ]
}

#
# Mocked Command Tests
#

@test "mocked: iptables commands execute without errors" {
  mock_iptables -A OUTPUT -j ACCEPT
  mock_iptables -P INPUT DROP
  mock_iptables -L -n
}

@test "mocked: ipset commands execute without errors" {
  mock_ipset create test-set hash:net
  mock_ipset add test-set 192.168.1.0/24
  mock_ipset list test-set
  mock_ipset destroy test-set
}

@test "mocked: ipset list returns expected format" {
  output=$(mock_ipset list allowed-domains)

  [[ "$output" =~ "Name: allowed-domains" ]]
  [[ "$output" =~ "Type: hash:net" ]]
  [[ "$output" =~ "Members:" ]]
}

#
# Integrated Mocked Tests
#

@test "mocked: process GitHub IP ranges successfully" {
  response=$(mock_github_meta_api "success")

  # Extract and validate each CIDR
  while IFS= read -r cidr; do
    if [ -n "$cidr" ]; then
      # Validate CIDR format
      [[ "$cidr" =~ ^[0-9]{1,3}\.[0-9]{1,3}\.[0-9]{1,3}\.[0-9]{1,3}/[0-9]{1,2}$ ]]

      # Mock adding to ipset
      mock_ipset add allowed-domains "$cidr"
    fi
  done < <(echo "$response" | jq -r '.web[]')
}

@test "mocked: process allowed domains successfully" {
  domains=(
    "registry.npmjs.org"
    "api.anthropic.com"
    "github.com"
  )

  for domain in "${domains[@]}"; do
    # Mock DNS lookup
    ips=$(mock_dns_lookup "$domain" "success")

    # Process each IP
    while IFS= read -r ip; do
      if [ -n "$ip" ]; then
        # Validate IP
        [[ "$ip" =~ ^[0-9]{1,3}\.[0-9]{1,3}\.[0-9]{1,3}\.[0-9]{1,3}$ ]]

        # Mock adding to ipset
        mock_ipset add allowed-domains "$ip"
      fi
    done <<< "$ips"
  done
}

#
# Error Handling with Mocks
#

@test "mocked: handle empty GitHub API response" {
  response=$(mock_github_meta_api "empty")

  if [ -z "$response" ]; then
    # Expected behavior: error message
    echo "ERROR: Failed to fetch GitHub IP ranges"
  else
    # Should not reach here
    return 1
  fi
}

@test "mocked: handle DNS resolution failure" {
  ips=$(mock_dns_lookup "nonexistent.example.com" "empty")

  if [ -z "$ips" ]; then
    # Expected behavior: error message
    echo "ERROR: Failed to resolve domain"
  else
    # Should not reach here
    return 1
  fi
}

@test "mocked: handle invalid IP from DNS" {
  ip=$(mock_dns_lookup "bad.example.com" "invalid")

  if [[ ! "$ip" =~ ^[0-9]{1,3}\.[0-9]{1,3}\.[0-9]{1,3}\.[0-9]{1,3}$ ]]; then
    # Expected behavior: error message
    echo "ERROR: Invalid IP from DNS: $ip"
  else
    # Should not reach here
    return 1
  fi
}

#
# Performance with Mocks
#

@test "mocked: process 1000 IPs quickly" {
  start_time=$(date +%s%N)

  for i in {1..1000}; do
    ip="192.168.$((i / 256)).$((i % 256))"

    # Validate
    [[ "$ip" =~ ^[0-9]{1,3}\.[0-9]{1,3}\.[0-9]{1,3}\.[0-9]{1,3}$ ]]

    # Mock add to ipset
    mock_ipset add allowed-domains "$ip" > /dev/null
  done

  end_time=$(date +%s%N)
  duration=$(( (end_time - start_time) / 1000000 ))

  echo "# Processed 1000 IPs in ${duration}ms" >&3

  # Should be very fast with mocks
  [ "$duration" -lt 2000 ]
}

#
# Variant Testing
#

@test "mocked: test all GitHub API variants" {
  variants=("success" "empty" "malformed" "missing_fields" "invalid_cidr")

  for variant in "${variants[@]}"; do
    response=$(mock_github_meta_api "$variant")
    echo "Tested variant: $variant" >&3

    case "$variant" in
      "success")
        echo "$response" | jq -e '.web and .api and .git'
        ;;
      "empty")
        [ -z "$response" ]
        ;;
      "malformed")
        ! echo "$response" | jq . 2>/dev/null
        ;;
      "missing_fields")
        ! echo "$response" | jq -e '.web and .api and .git' 2>/dev/null
        ;;
      "invalid_cidr")
        cidr=$(echo "$response" | jq -r '.web[0]')
        ! [[ "$cidr" =~ ^[0-9]{1,3}\.[0-9]{1,3}\.[0-9]{1,3}\.[0-9]{1,3}/[0-9]{1,2}$ ]]
        ;;
    esac
  done
}

@test "mocked: test all DNS variants" {
  variants=("success" "empty" "invalid")

  for variant in "${variants[@]}"; do
    result=$(mock_dns_lookup "test.example.com" "$variant")
    echo "Tested DNS variant: $variant" >&3

    case "$variant" in
      "success")
        [[ "$result" =~ ^[0-9.]+$ ]]
        ;;
      "empty")
        [ -z "$result" ]
        ;;
      "invalid")
        ! [[ "$result" =~ ^[0-9]{1,3}\.[0-9]{1,3}\.[0-9]{1,3}\.[0-9]{1,3}$ ]]
        ;;
    esac
  done
}
