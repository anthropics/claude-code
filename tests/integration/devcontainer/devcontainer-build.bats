#!/usr/bin/env bats
# Integration tests for DevContainer configuration

load '../../test-helper'

setup() {
  test_setup
}

teardown() {
  test_teardown
}

@test "devcontainer.json is valid JSON" {
  run jq empty "$PROJECT_ROOT/.devcontainer/devcontainer.json"
  assert_success
}

@test "devcontainer.json specifies correct Dockerfile" {
  local dockerfile=$(jq -r '.build.dockerfile' "$PROJECT_ROOT/.devcontainer/devcontainer.json")
  [ "$dockerfile" = "Dockerfile" ]
}

@test "devcontainer.json specifies correct remote user" {
  local user=$(jq -r '.remoteUser' "$PROJECT_ROOT/.devcontainer/devcontainer.json")
  [ "$user" = "node" ]
}

@test "devcontainer.json includes required VS Code extensions" {
  local extensions=$(jq -r '.customizations.vscode.extensions[]' "$PROJECT_ROOT/.devcontainer/devcontainer.json")

  echo "$extensions" | grep -q "dbaeumer.vscode-eslint"
  echo "$extensions" | grep -q "esbenp.prettier-vscode"
}

@test "devcontainer.json configures firewall init script" {
  local post_create=$(jq -r '.postCreateCommand' "$PROJECT_ROOT/.devcontainer/devcontainer.json")
  [[ "$post_create" == *"init-firewall.sh"* ]]
}

@test "devcontainer.json includes required capabilities" {
  local run_args=$(jq -r '.runArgs[]' "$PROJECT_ROOT/.devcontainer/devcontainer.json")

  echo "$run_args" | grep -q "NET_ADMIN"
  echo "$run_args" | grep -q "NET_RAW"
}

@test "devcontainer.json mounts required volumes" {
  local mounts=$(jq -r '.mounts[]' "$PROJECT_ROOT/.devcontainer/devcontainer.json")

  echo "$mounts" | grep -q "bashhistory"
  echo "$mounts" | grep -q "claude"
}

@test "devcontainer.json sets NODE_OPTIONS" {
  local node_options=$(jq -r '.remoteEnv.NODE_OPTIONS' "$PROJECT_ROOT/.devcontainer/devcontainer.json")
  [[ "$node_options" == *"max-old-space-size"* ]]
}

@test "Dockerfile uses correct base image" {
  local base_image=$(grep "^FROM" "$PROJECT_ROOT/.devcontainer/Dockerfile" | head -1 | awk '{print $2}')
  [[ "$base_image" == node:* ]]
}

@test "Dockerfile installs required system packages" {
  local required_packages=(
    "git"
    "sudo"
    "zsh"
    "gh"
    "iptables"
    "ipset"
    "jq"
  )

  for package in "${required_packages[@]}"; do
    grep -q "$package" "$PROJECT_ROOT/.devcontainer/Dockerfile"
  done
}

@test "Dockerfile installs Claude Code globally" {
  grep -q "npm install -g @anthropic-ai/claude-code" "$PROJECT_ROOT/.devcontainer/Dockerfile"
}

@test "Dockerfile copies init-firewall.sh script" {
  grep -q "COPY init-firewall.sh" "$PROJECT_ROOT/.devcontainer/Dockerfile"
}

@test "Dockerfile sets correct permissions for firewall script" {
  grep -q "chmod +x.*init-firewall.sh" "$PROJECT_ROOT/.devcontainer/Dockerfile"
}

@test "init-firewall.sh script is executable" {
  [ -x "$PROJECT_ROOT/.devcontainer/init-firewall.sh" ]
}

@test "init-firewall.sh script passes shellcheck" {
  if ! command -v shellcheck >/dev/null 2>&1; then
    skip "shellcheck not installed"
  fi

  run shellcheck "$PROJECT_ROOT/.devcontainer/init-firewall.sh"
  assert_success
}
