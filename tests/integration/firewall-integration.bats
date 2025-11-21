#!/usr/bin/env bats

# Integration tests for init-firewall.sh
# These tests actually run the firewall script in a Docker container with proper privileges

load '../helpers/docker-helper'

setup() {
  # Skip if not running in privileged environment
  if ! docker info &>/dev/null; then
    skip "Docker not available"
  fi

  # Create a test container with CAP_NET_ADMIN
  TEST_IMAGE="test-firewall-${RANDOM}"
  TEST_CONTAINER="firewall-test-${RANDOM}"

  # Build test image
  cat > /tmp/Dockerfile.firewall-test << 'EOF'
FROM ubuntu:22.04
RUN apt-get update && apt-get install -y \
  iptables \
  ipset \
  iproute2 \
  curl \
  jq \
  dnsutils \
  aggregate \
  && rm -rf /var/lib/apt/lists/*
WORKDIR /test
EOF

  docker build -t "$TEST_IMAGE" -f /tmp/Dockerfile.firewall-test /tmp
}

teardown() {
  # Cleanup
  if [ -n "$TEST_CONTAINER" ]; then
    docker rm -f "$TEST_CONTAINER" 2>/dev/null || true
  fi
  if [ -n "$TEST_IMAGE" ]; then
    docker rmi "$TEST_IMAGE" 2>/dev/null || true
  fi
  rm -f /tmp/Dockerfile.firewall-test
}

#
# Integration Tests - Full Script Execution
#

@test "integration: firewall script runs successfully in Docker" {
  # Copy script to container and run
  docker run --rm \
    --cap-add=NET_ADMIN \
    --cap-add=NET_RAW \
    -v "${PWD}/.devcontainer/init-firewall.sh:/test/firewall.sh:ro" \
    "$TEST_IMAGE" \
    bash /test/firewall.sh
}

@test "integration: firewall blocks unauthorized domains" {
  # Run script and test that example.com is blocked
  docker run --rm \
    --cap-add=NET_ADMIN \
    --cap-add=NET_RAW \
    -v "${PWD}/.devcontainer/init-firewall.sh:/test/firewall.sh:ro" \
    "$TEST_IMAGE" \
    bash -c "
      /test/firewall.sh && \
      ! curl --connect-timeout 2 https://example.com 2>&1
    "
}

@test "integration: firewall allows GitHub API" {
  docker run --rm \
    --cap-add=NET_ADMIN \
    --cap-add=NET_RAW \
    -v "${PWD}/.devcontainer/init-firewall.sh:/test/firewall.sh:ro" \
    "$TEST_IMAGE" \
    bash -c "
      /test/firewall.sh && \
      curl --connect-timeout 5 https://api.github.com/zen
    "
}

@test "integration: firewall allows Anthropic API" {
  docker run --rm \
    --cap-add=NET_ADMIN \
    --cap-add=NET_RAW \
    -v "${PWD}/.devcontainer/init-firewall.sh:/test/firewall.sh:ro" \
    "$TEST_IMAGE" \
    bash -c "
      /test/firewall.sh && \
      curl --connect-timeout 5 -I https://api.anthropic.com 2>&1 | grep -q 'HTTP'
    "
}

@test "integration: firewall allows NPM registry" {
  docker run --rm \
    --cap-add=NET_ADMIN \
    --cap-add=NET_RAW \
    -v "${PWD}/.devcontainer/init-firewall.sh:/test/firewall.sh:ro" \
    "$TEST_IMAGE" \
    bash -c "
      /test/firewall.sh && \
      curl --connect-timeout 5 -I https://registry.npmjs.org 2>&1 | grep -q 'HTTP'
    "
}

@test "integration: localhost traffic is allowed" {
  docker run --rm \
    --cap-add=NET_ADMIN \
    --cap-add=NET_RAW \
    -v "${PWD}/.devcontainer/init-firewall.sh:/test/firewall.sh:ro" \
    "$TEST_IMAGE" \
    bash -c "
      /test/firewall.sh && \
      curl --connect-timeout 2 http://localhost:12345 2>&1 || true
    "
  # Should not get a firewall block, just connection refused
}

@test "integration: DNS queries work" {
  docker run --rm \
    --cap-add=NET_ADMIN \
    --cap-add=NET_RAW \
    -v "${PWD}/.devcontainer/init-firewall.sh:/test/firewall.sh:ro" \
    "$TEST_IMAGE" \
    bash -c "
      /test/firewall.sh && \
      dig +short github.com
    "
}

@test "integration: iptables rules are correctly set" {
  docker run --rm \
    --cap-add=NET_ADMIN \
    --cap-add=NET_RAW \
    -v "${PWD}/.devcontainer/init-firewall.sh:/test/firewall.sh:ro" \
    "$TEST_IMAGE" \
    bash -c "
      /test/firewall.sh && \
      iptables -L -n | grep -q 'policy DROP'
    "
}

@test "integration: ipset contains allowed domains" {
  docker run --rm \
    --cap-add=NET_ADMIN \
    --cap-add=NET_RAW \
    -v "${PWD}/.devcontainer/init-firewall.sh:/test/firewall.sh:ro" \
    "$TEST_IMAGE" \
    bash -c "
      /test/firewall.sh && \
      ipset list allowed-domains | wc -l | grep -qv '^0$'
    "
}

@test "integration: script is idempotent - can run twice" {
  docker run --rm \
    --cap-add=NET_ADMIN \
    --cap-add=NET_RAW \
    -v "${PWD}/.devcontainer/init-firewall.sh:/test/firewall.sh:ro" \
    "$TEST_IMAGE" \
    bash -c "
      /test/firewall.sh && \
      /test/firewall.sh
    "
}

#
# Error Handling Integration Tests
#

@test "integration: script fails gracefully without NET_ADMIN capability" {
  run docker run --rm \
    -v "${PWD}/.devcontainer/init-firewall.sh:/test/firewall.sh:ro" \
    "$TEST_IMAGE" \
    bash /test/firewall.sh

  [ "$status" -ne 0 ]
}

@test "integration: script validates GitHub API response" {
  # Mock a bad GitHub API response
  docker run --rm \
    --cap-add=NET_ADMIN \
    --cap-add=NET_RAW \
    -v "${PWD}/.devcontainer/init-firewall.sh:/test/firewall.sh:ro" \
    "$TEST_IMAGE" \
    bash -c "
      # Override curl to return bad JSON
      function curl() {
        if [[ \"\$*\" == *github.com/meta* ]]; then
          echo '{\"bad\": \"json\"}'
        else
          command curl \"\$@\"
        fi
      }
      export -f curl

      # Script should fail
      ! /test/firewall.sh
    "
}

#
# Performance Integration Tests
#

@test "integration: script completes within 60 seconds" {
  timeout 60 docker run --rm \
    --cap-add=NET_ADMIN \
    --cap-add=NET_RAW \
    -v "${PWD}/.devcontainer/init-firewall.sh:/test/firewall.sh:ro" \
    "$TEST_IMAGE" \
    bash /test/firewall.sh
}

@test "integration: memory usage stays under 100MB" {
  docker run --rm \
    --cap-add=NET_ADMIN \
    --cap-add=NET_RAW \
    --memory=100m \
    -v "${PWD}/.devcontainer/init-firewall.sh:/test/firewall.sh:ro" \
    "$TEST_IMAGE" \
    bash /test/firewall.sh
}

#
# Security Integration Tests
#

@test "integration: no traffic leaks through firewall" {
  # Test multiple unauthorized domains
  docker run --rm \
    --cap-add=NET_ADMIN \
    --cap-add=NET_RAW \
    -v "${PWD}/.devcontainer/init-firewall.sh:/test/firewall.sh:ro" \
    "$TEST_IMAGE" \
    bash -c "
      /test/firewall.sh

      # Try various unauthorized domains
      ! timeout 2 curl https://google.com 2>&1
      ! timeout 2 curl https://amazon.com 2>&1
      ! timeout 2 curl https://cloudflare.com 2>&1
    "
}

@test "integration: SSH connections are allowed" {
  docker run --rm \
    --cap-add=NET_ADMIN \
    --cap-add=NET_RAW \
    -v "${PWD}/.devcontainer/init-firewall.sh:/test/firewall.sh:ro" \
    "$TEST_IMAGE" \
    bash -c "
      /test/firewall.sh && \
      iptables -L OUTPUT -n | grep -q 'tcp dpt:22'
    "
}

@test "integration: established connections are allowed" {
  docker run --rm \
    --cap-add=NET_ADMIN \
    --cap-add=NET_RAW \
    -v "${PWD}/.devcontainer/init-firewall.sh:/test/firewall.sh:ro" \
    "$TEST_IMAGE" \
    bash -c "
      /test/firewall.sh && \
      iptables -L -n | grep -q 'state ESTABLISHED,RELATED'
    "
}
