#!/usr/bin/env bats
# Tests for GitHub Actions action.yml files

load '../../test-helper'

setup() {
  test_setup
}

teardown() {
  test_teardown
}

@test "claude-code-action action.yml is valid YAML" {
  run grep -v "^#" "$PROJECT_ROOT/.github/actions/claude-code-action/action.yml"
  assert_success
}

@test "claude-code-action has required inputs" {
  local required_inputs=(
    "github_token"
    "anthropic_api_key"
  )

  for input in "${required_inputs[@]}"; do
    grep -q "$input:" "$PROJECT_ROOT/.github/actions/claude-code-action/action.yml"
  done
}

@test "claude-code-action has optional inputs" {
  local optional_inputs=(
    "prompt"
    "prompt_file"
    "allowed_tools"
    "output_file"
    "timeout_minutes"
  )

  for input in "${optional_inputs[@]}"; do
    grep -q "$input:" "$PROJECT_ROOT/.github/actions/claude-code-action/action.yml"
  done
}

@test "claude-code-action has default timeout" {
  grep -A 3 "timeout_minutes:" "$PROJECT_ROOT/.github/actions/claude-code-action/action.yml" | grep -q 'default: "10"'
}

@test "claude-code-action installs Claude Code" {
  grep -q "npm install -g @anthropic-ai/claude-code" "$PROJECT_ROOT/.github/actions/claude-code-action/action.yml"
}

@test "claude-code-action has prompt validation" {
  local validation=$(grep -A 5 "Prepare Prompt File" "$PROJECT_ROOT/.github/actions/claude-code-action/action.yml")

  echo "$validation" | grep -q "Neither.*prompt.*nor.*prompt_file"
}

@test "claude-code-action checks prompt file exists" {
  grep -q "if \[ ! -f.*prompt_file" "$PROJECT_ROOT/.github/actions/claude-code-action/action.yml"
}

@test "claude-code-action checks prompt not empty" {
  grep -q "if \[ ! -s.*PROMPT_PATH" "$PROJECT_ROOT/.github/actions/claude-code-action/action.yml"
}

@test "claude-code-action uses composite run" {
  grep -q "using: \"composite\"" "$PROJECT_ROOT/.github/actions/claude-code-action/action.yml"
}

@test "claude-issue-triage-action action.yml is valid YAML" {
  run grep -v "^#" "$PROJECT_ROOT/.github/actions/claude-issue-triage-action/action.yml"
  assert_success
}

@test "claude-issue-triage-action has required inputs" {
  local required_inputs=(
    "anthropic_api_key"
    "github_token"
  )

  for input in "${required_inputs[@]}"; do
    grep -q "$input:" "$PROJECT_ROOT/.github/actions/claude-issue-triage-action/action.yml"
  done
}

@test "claude-issue-triage-action creates prompt file" {
  grep -q "cat > /tmp/claude-prompts/claude-issue-triage-prompt.txt" "$PROJECT_ROOT/.github/actions/claude-issue-triage-action/action.yml"
}

@test "claude-issue-triage-action uses claude-code-action" {
  grep -q "uses: ./.github/actions/claude-code-action" "$PROJECT_ROOT/.github/actions/claude-issue-triage-action/action.yml"
}

@test "claude-issue-triage-action enables GitHub MCP" {
  grep -q 'install_github_mcp: "true"' "$PROJECT_ROOT/.github/actions/claude-issue-triage-action/action.yml"
}

@test "claude-issue-triage-action restricts allowed tools" {
  grep -q "allowed_tools:" "$PROJECT_ROOT/.github/actions/claude-issue-triage-action/action.yml"
}

@test "claude-issue-triage-action prompt mentions not to comment" {
  grep -A 80 "cat > /tmp/claude-prompts" "$PROJECT_ROOT/.github/actions/claude-issue-triage-action/action.yml" | \
    grep -q "DO NOT post any comments"
}

@test "both actions use composite run type" {
  grep -q 'using: "composite"' "$PROJECT_ROOT/.github/actions/claude-code-action/action.yml"
  grep -q 'using: "composite"' "$PROJECT_ROOT/.github/actions/claude-issue-triage-action/action.yml"
}

@test "both actions have descriptions" {
  grep -q "^description:" "$PROJECT_ROOT/.github/actions/claude-code-action/action.yml"
  grep -q "^description:" "$PROJECT_ROOT/.github/actions/claude-issue-triage-action/action.yml"
}
