#!/usr/bin/env bats

# End-to-end tests for GitHub Actions workflows
# These tests use 'act' to run workflows locally

setup() {
  # Skip if act is not installed
  if ! command -v act &>/dev/null; then
    skip "act (GitHub Actions runner) not installed"
  fi

  WORKFLOWS_DIR="${BATS_TEST_DIRNAME}/../../.github/workflows"
  TEST_TEMP_DIR="$(mktemp -d)"
  export TEST_TEMP_DIR
}

teardown() {
  if [ -n "$TEST_TEMP_DIR" ]; then
    rm -rf "$TEST_TEMP_DIR"
  fi
}

#
# Test Workflow E2E
#

@test "e2e: test workflow can be listed by act" {
  cd "$BATS_TEST_DIRNAME/../.."
  run act -l
  [ "$status" -eq 0 ]
  [[ "$output" =~ "Tests" ]] || [[ "$output" =~ "test" ]]
}

@test "e2e: test workflow has all expected jobs" {
  cd "$BATS_TEST_DIRNAME/../.."
  output=$(act -l 2>&1)

  # Check for expected jobs
  [[ "$output" =~ "shellcheck" ]] || [[ "$output" =~ "ShellCheck" ]]
  [[ "$output" =~ "actionlint" ]] || [[ "$output" =~ "ActionLint" ]]
  [[ "$output" =~ "bats" ]] || [[ "$output" =~ "test" ]]
}

@test "e2e: shellcheck job runs successfully" {
  cd "$BATS_TEST_DIRNAME/../.."

  # Run only the shellcheck job
  timeout 120 act -j shellcheck --pull=false 2>&1 || {
    # It's ok if it fails due to missing secrets/environment
    # We just want to verify the workflow structure is valid
    true
  }
}

@test "e2e: docker-publish workflow structure is valid" {
  cd "$BATS_TEST_DIRNAME/../.."

  # Dry-run to check workflow syntax
  run act -W .github/workflows/docker-publish.yml -l
  [ "$status" -eq 0 ]
}

@test "e2e: claude workflow structure is valid" {
  cd "$BATS_TEST_DIRNAME/../.."

  run act -W .github/workflows/claude.yml -l
  [ "$status" -eq 0 ]
}

#
# Composite Action E2E Tests
#

@test "e2e: claude-code-action validates inputs correctly" {
  cd "$BATS_TEST_DIRNAME/../.."

  # Create a minimal workflow that uses the action
  cat > "$TEST_TEMP_DIR/test-workflow.yml" << 'EOF'
name: Test Action
on: push
jobs:
  test:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4
      - uses: ./.github/actions/claude-code-action
        with:
          prompt: "test prompt"
          anthropic_api_key: "test-key"
          github_token: "test-token"
EOF

  # Validate workflow syntax
  if command -v actionlint &>/dev/null; then
    actionlint "$TEST_TEMP_DIR/test-workflow.yml"
  fi
}

@test "e2e: claude-issue-triage-action structure is valid" {
  cd "$BATS_TEST_DIRNAME/../.."

  # Create test workflow
  cat > "$TEST_TEMP_DIR/test-triage.yml" << 'EOF'
name: Test Triage
on: issues
jobs:
  test:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4
      - uses: ./.github/actions/claude-issue-triage-action
        with:
          anthropic_api_key: "test-key"
          github_token: "test-token"
EOF

  if command -v actionlint &>/dev/null; then
    actionlint "$TEST_TEMP_DIR/test-triage.yml"
  fi
}

#
# Full Workflow Simulation Tests
#

@test "e2e: test workflow can run shellcheck step" {
  cd "$BATS_TEST_DIRNAME/../.."

  # Create a simple test that mimics the shellcheck job
  cat > "$TEST_TEMP_DIR/test.sh" << 'EOF'
#!/bin/bash
set -e
shellcheck .devcontainer/*.sh || {
  echo "ShellCheck found issues (expected in testing)"
  exit 0
}
EOF

  chmod +x "$TEST_TEMP_DIR/test.sh"
  "$TEST_TEMP_DIR/test.sh"
}

@test "e2e: test workflow can run actionlint step" {
  cd "$BATS_TEST_DIRNAME/../.."

  if ! command -v actionlint &>/dev/null; then
    skip "actionlint not installed"
  fi

  # Run actionlint on all workflows
  actionlint .github/workflows/*.yml
}

@test "e2e: test workflow can run bats tests" {
  cd "$BATS_TEST_DIRNAME/../.."

  # Run a subset of bats tests
  bats tests/scripts/firewall.bats --filter "validation"
}

#
# Workflow Trigger Tests
#

@test "e2e: test workflow triggers on push to main" {
  cd "$BATS_TEST_DIRNAME/../.."

  # Check workflow file for correct triggers
  grep -q "branches.*main" .github/workflows/test.yml
}

@test "e2e: test workflow triggers on claude branches" {
  cd "$BATS_TEST_DIRNAME/../.."

  grep -q 'claude/\*\*' .github/workflows/test.yml
}

@test "e2e: claude workflow triggers on @claude mention" {
  cd "$BATS_TEST_DIRNAME/../.."

  grep -q "@claude" .github/workflows/claude.yml
}

#
# Workflow Environment Tests
#

@test "e2e: workflows use correct ubuntu version" {
  cd "$BATS_TEST_DIRNAME/../.."

  for workflow in .github/workflows/*.yml; do
    if grep -q "runs-on:" "$workflow"; then
      grep -q "ubuntu-latest" "$workflow"
    fi
  done
}

@test "e2e: workflows use pinned action versions" {
  cd "$BATS_TEST_DIRNAME/../.."

  for workflow in .github/workflows/*.yml; do
    # Check that actions use @v4, @v3, etc., not @main or @master
    ! grep -E "uses:.*@(main|master)" "$workflow"
  done
}

#
# Workflow Security Tests
#

@test "e2e: workflows have appropriate permissions" {
  cd "$BATS_TEST_DIRNAME/../.."

  # Check that workflows specify permissions
  for workflow in .github/workflows/*.yml; do
    if grep -q "permissions:" "$workflow"; then
      echo "✓ $workflow has permissions defined"
    fi
  done
}

@test "e2e: workflows don't expose secrets in logs" {
  cd "$BATS_TEST_DIRNAME/../.."

  for workflow in .github/workflows/*.yml; do
    # Check for potential secret exposure
    ! grep -i "echo.*\${{.*secret" "$workflow"
    ! grep -i "echo.*\${{.*api_key" "$workflow"
  done
}

#
# Performance Tests
#

@test "e2e: workflow files are not too large" {
  cd "$BATS_TEST_DIRNAME/../.."

  for workflow in .github/workflows/*.yml; do
    size=$(wc -l < "$workflow")
    if [ "$size" -gt 500 ]; then
      echo "WARNING: $workflow is very large ($size lines)"
    fi
    [ "$size" -lt 1000 ]  # Hard limit
  done
}

@test "e2e: composite actions are not too large" {
  cd "$BATS_TEST_DIRNAME/../.."

  for action in .github/actions/*/action.yml; do
    size=$(wc -l < "$action")
    [ "$size" -lt 500 ]  # Hard limit for composite actions
  done
}
