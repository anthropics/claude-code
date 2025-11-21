#!/usr/bin/env bats

# Test suite for GitHub Actions workflows
# Validates workflow syntax, triggers, and configuration

setup() {
  WORKFLOWS_DIR="${BATS_TEST_DIRNAME}/../../.github/workflows"
}

#
# Docker Publish Workflow Tests
#

@test "docker-publish.yml: workflow file exists" {
  [ -f "$WORKFLOWS_DIR/docker-publish.yml" ]
}

@test "docker-publish.yml: has correct name" {
  grep -q "name: Docker" "$WORKFLOWS_DIR/docker-publish.yml"
}

@test "docker-publish.yml: triggers on push to main" {
  grep -A5 "^on:" "$WORKFLOWS_DIR/docker-publish.yml" | grep -q "branches.*main"
}

@test "docker-publish.yml: triggers on tags" {
  grep -A5 "^on:" "$WORKFLOWS_DIR/docker-publish.yml" | grep -q "tags.*v\*\.\*\.\*"
}

@test "docker-publish.yml: triggers on pull request" {
  grep -A5 "^on:" "$WORKFLOWS_DIR/docker-publish.yml" | grep -q "pull_request"
}

@test "docker-publish.yml: has schedule trigger" {
  grep -q "schedule:" "$WORKFLOWS_DIR/docker-publish.yml"
}

@test "docker-publish.yml: uses ubuntu-latest" {
  grep -q "runs-on: ubuntu-latest" "$WORKFLOWS_DIR/docker-publish.yml"
}

@test "docker-publish.yml: has required permissions" {
  grep -q "permissions:" "$WORKFLOWS_DIR/docker-publish.yml"
  grep -q "contents: read" "$WORKFLOWS_DIR/docker-publish.yml"
  grep -q "packages: write" "$WORKFLOWS_DIR/docker-publish.yml"
  grep -q "id-token: write" "$WORKFLOWS_DIR/docker-publish.yml"
}

@test "docker-publish.yml: checks out repository" {
  grep -q "actions/checkout@v4" "$WORKFLOWS_DIR/docker-publish.yml"
}

@test "docker-publish.yml: installs cosign on non-PR" {
  grep -q "sigstore/cosign-installer" "$WORKFLOWS_DIR/docker-publish.yml"
}

@test "docker-publish.yml: sets up Docker Buildx" {
  grep -q "docker/setup-buildx-action" "$WORKFLOWS_DIR/docker-publish.yml"
}

@test "docker-publish.yml: logs into registry" {
  grep -q "docker/login-action" "$WORKFLOWS_DIR/docker-publish.yml"
}

@test "docker-publish.yml: extracts metadata" {
  grep -q "docker/metadata-action" "$WORKFLOWS_DIR/docker-publish.yml"
}

@test "docker-publish.yml: builds and pushes image" {
  grep -q "docker/build-push-action" "$WORKFLOWS_DIR/docker-publish.yml"
}

@test "docker-publish.yml: signs image on non-PR" {
  grep -q "cosign sign" "$WORKFLOWS_DIR/docker-publish.yml"
}

@test "docker-publish.yml: uses cache" {
  grep -q "cache-from: type=gha" "$WORKFLOWS_DIR/docker-publish.yml"
  grep -q "cache-to: type=gha,mode=max" "$WORKFLOWS_DIR/docker-publish.yml"
}

#
# Claude Code Workflow Tests
#

@test "claude.yml: workflow file exists" {
  [ -f "$WORKFLOWS_DIR/claude.yml" ]
}

@test "claude.yml: has correct name" {
  grep -q "name: Claude Code" "$WORKFLOWS_DIR/claude.yml"
}

@test "claude.yml: triggers on issue_comment" {
  grep -q "issue_comment:" "$WORKFLOWS_DIR/claude.yml"
}

@test "claude.yml: triggers on pull_request_review_comment" {
  grep -q "pull_request_review_comment:" "$WORKFLOWS_DIR/claude.yml"
}

@test "claude.yml: triggers on issues opened" {
  grep -q "issues:" "$WORKFLOWS_DIR/claude.yml"
}

@test "claude.yml: triggers on pull_request_review" {
  grep -q "pull_request_review:" "$WORKFLOWS_DIR/claude.yml"
}

@test "claude.yml: has conditional execution for @claude mention" {
  grep -q "contains(github.event.comment.body, '@claude')" "$WORKFLOWS_DIR/claude.yml"
}

@test "claude.yml: checks for @claude in issue title and body" {
  grep -q "contains(github.event.issue.body, '@claude')" "$WORKFLOWS_DIR/claude.yml"
  grep -q "contains(github.event.issue.title, '@claude')" "$WORKFLOWS_DIR/claude.yml"
}

@test "claude.yml: has correct permissions" {
  grep -A5 "permissions:" "$WORKFLOWS_DIR/claude.yml" | grep -q "contents: read"
  grep -A5 "permissions:" "$WORKFLOWS_DIR/claude.yml" | grep -q "pull-requests: read"
  grep -A5 "permissions:" "$WORKFLOWS_DIR/claude.yml" | grep -q "issues: read"
  grep -A5 "permissions:" "$WORKFLOWS_DIR/claude.yml" | grep -q "id-token: write"
}

@test "claude.yml: uses claude-code-action" {
  grep -q "uses: anthropics/claude-code-action@beta" "$WORKFLOWS_DIR/claude.yml"
}

@test "claude.yml: passes anthropic_api_key" {
  grep -q "anthropic_api_key:.*ANTHROPIC_API_KEY" "$WORKFLOWS_DIR/claude.yml"
}

@test "claude.yml: uses fetch-depth 1" {
  grep -A3 "actions/checkout@v4" "$WORKFLOWS_DIR/claude.yml" | grep -q "fetch-depth: 1"
}

#
# Claude Issue Triage Workflow Tests
#

@test "claude-issue-triage.yml: workflow file exists" {
  [ -f "$WORKFLOWS_DIR/claude-issue-triage.yml" ]
}

@test "claude-issue-triage.yml: has correct name" {
  grep -q "name: Claude Issue Triage" "$WORKFLOWS_DIR/claude-issue-triage.yml"
}

@test "claude-issue-triage.yml: triggers only on issues opened" {
  grep -A2 "^on:" "$WORKFLOWS_DIR/claude-issue-triage.yml" | grep -q "types.*opened"
}

@test "claude-issue-triage.yml: has timeout" {
  grep -q "timeout-minutes: 10" "$WORKFLOWS_DIR/claude-issue-triage.yml"
}

@test "claude-issue-triage.yml: has correct permissions" {
  grep -A3 "permissions:" "$WORKFLOWS_DIR/claude-issue-triage.yml" | grep -q "contents: read"
  grep -A3 "permissions:" "$WORKFLOWS_DIR/claude-issue-triage.yml" | grep -q "issues: write"
}

@test "claude-issue-triage.yml: uses local action" {
  grep -q "uses: ./.github/actions/claude-issue-triage-action" "$WORKFLOWS_DIR/claude-issue-triage.yml"
}

@test "claude-issue-triage.yml: passes required secrets" {
  grep -q "anthropic_api_key:.*ANTHROPIC_API_KEY" "$WORKFLOWS_DIR/claude-issue-triage.yml"
  grep -q "github_token:.*GITHUB_TOKEN" "$WORKFLOWS_DIR/claude-issue-triage.yml"
}

#
# General Workflow Quality Tests
#

@test "all workflows: use actions/checkout@v4" {
  for workflow in "$WORKFLOWS_DIR"/*.yml; do
    if grep -q "actions/checkout" "$workflow"; then
      if ! grep -q "actions/checkout@v4" "$workflow"; then
        echo "Workflow $(basename $workflow) uses outdated checkout version"
        return 1
      fi
    fi
  done
}

@test "all workflows: have descriptive names" {
  for workflow in "$WORKFLOWS_DIR"/*.yml; do
    if ! grep -q "^name:" "$workflow"; then
      echo "Workflow $(basename $workflow) missing name"
      return 1
    fi
  done
}

@test "all workflows: specify runs-on" {
  for workflow in "$WORKFLOWS_DIR"/*.yml; do
    if ! grep -q "runs-on:" "$workflow"; then
      echo "Workflow $(basename $workflow) missing runs-on"
      return 1
    fi
  done
}

@test "all workflows: use SHA-pinned or tagged actions for security" {
  # Check that critical actions use SHA pins or version tags
  for workflow in "$WORKFLOWS_DIR"/*.yml; do
    # Allow @v4, @v3, etc., or @sha-... for actions
    if grep -E "uses:.*@(main|master|latest)" "$workflow"; then
      echo "Workflow $(basename $workflow) uses unpinned action version"
      return 1
    fi
  done
}

@test "no workflow uses deprecated actions" {
  deprecated_actions=(
    "actions/checkout@v1"
    "actions/checkout@v2"
    "actions/setup-node@v1"
  )

  for workflow in "$WORKFLOWS_DIR"/*.yml; do
    for action in "${deprecated_actions[@]}"; do
      if grep -q "$action" "$workflow"; then
        echo "Workflow $(basename $workflow) uses deprecated action: $action"
        return 1
      fi
    done
  done
}
