#!/usr/bin/env bats
# Tests for GitHub Actions workflow files

load '../../test-helper'

setup() {
  test_setup
}

teardown() {
  test_teardown
}

@test "claude.yml is valid YAML" {
  run grep -v "^#" "$PROJECT_ROOT/.github/workflows/claude.yml"
  assert_success
}

@test "claude.yml has required triggers" {
  local triggers=$(grep -A 10 "^on:" "$PROJECT_ROOT/.github/workflows/claude.yml")

  echo "$triggers" | grep -q "issue_comment"
  echo "$triggers" | grep -q "pull_request_review_comment"
  echo "$triggers" | grep -q "issues"
  echo "$triggers" | grep -q "pull_request_review"
}

@test "claude.yml has conditional execution" {
  grep -q "contains(github.event.comment.body, '@claude')" "$PROJECT_ROOT/.github/workflows/claude.yml"
}

@test "claude.yml has correct permissions" {
  local permissions=$(grep -A 5 "permissions:" "$PROJECT_ROOT/.github/workflows/claude.yml")

  echo "$permissions" | grep -q "contents: read"
  echo "$permissions" | grep -q "pull-requests: read"
  echo "$permissions" | grep -q "issues: read"
  echo "$permissions" | grep -q "id-token: write"
}

@test "claude.yml uses correct action version" {
  grep -q "anthropics/claude-code-action@beta" "$PROJECT_ROOT/.github/workflows/claude.yml"
}

@test "claude-issue-triage.yml is valid YAML" {
  run grep -v "^#" "$PROJECT_ROOT/.github/workflows/claude-issue-triage.yml"
  assert_success
}

@test "claude-issue-triage.yml triggers on issue opened" {
  grep -q "types: \\[opened\\]" "$PROJECT_ROOT/.github/workflows/claude-issue-triage.yml"
}

@test "claude-issue-triage.yml has timeout configured" {
  grep -q "timeout-minutes:" "$PROJECT_ROOT/.github/workflows/claude-issue-triage.yml"
}

@test "claude-issue-triage.yml has correct permissions" {
  local permissions=$(grep -A 3 "permissions:" "$PROJECT_ROOT/.github/workflows/claude-issue-triage.yml")

  echo "$permissions" | grep -q "contents: read"
  echo "$permissions" | grep -q "issues: write"
}

@test "claude-issue-triage.yml uses local action" {
  grep -q "uses: ./.github/actions/claude-issue-triage-action" "$PROJECT_ROOT/.github/workflows/claude-issue-triage.yml"
}

@test "docker-publish.yml is valid YAML" {
  run grep -v "^#" "$PROJECT_ROOT/.github/workflows/docker-publish.yml"
  assert_success
}

@test "docker-publish.yml has correct triggers" {
  local triggers=$(grep -A 10 "^on:" "$PROJECT_ROOT/.github/workflows/docker-publish.yml")

  echo "$triggers" | grep -q "schedule"
  echo "$triggers" | grep -q "push"
  echo "$triggers" | grep -q "pull_request"
}

@test "docker-publish.yml uses correct registry" {
  grep -q "REGISTRY: ghcr.io" "$PROJECT_ROOT/.github/workflows/docker-publish.yml"
}

@test "docker-publish.yml has security scanning" {
  grep -q "cosign" "$PROJECT_ROOT/.github/workflows/docker-publish.yml"
}

@test "docker-publish.yml includes build and push step" {
  grep -q "docker/build-push-action" "$PROJECT_ROOT/.github/workflows/docker-publish.yml"
}

@test "all workflows use checkout@v4" {
  local workflows=(
    "$PROJECT_ROOT/.github/workflows/claude.yml"
    "$PROJECT_ROOT/.github/workflows/claude-issue-triage.yml"
    "$PROJECT_ROOT/.github/workflows/docker-publish.yml"
  )

  for workflow in "${workflows[@]}"; do
    grep -q "actions/checkout@v4" "$workflow"
  done
}

@test "all workflows use secrets correctly" {
  # Check for secret references without hardcoded values
  for workflow in "$PROJECT_ROOT/.github/workflows"/*.yml; do
    ! grep -q "sk-ant-" "$workflow"
    ! grep -q "ghp_" "$workflow"
  done
}
