#!/usr/bin/env bash
# Guard hook: Prevents PRs and pushes targeting anthropics/claude-code (upstream).
# All PRs should target jadecli-experimental/claude-code (fork).
#
# This is a fork. GitHub defaults PR creation to the upstream parent repo.
# This hook enforces that --repo jadecli-experimental/claude-code is always used.

set -euo pipefail

INPUT=$(cat)
CMD=$(echo "$INPUT" | jq -r '.tool_input.command // empty')

# Guard 1: Block any gh pr create that explicitly targets anthropics/claude-code
if echo "$CMD" | grep -qE 'gh\s+pr\s+create'; then
  if echo "$CMD" | grep -qE 'anthropics/claude-code'; then
    echo '{"decision": "block", "reason": "BLOCKED: Do not create PRs against anthropics/claude-code (upstream). Target your fork instead. Use: gh pr create --repo jadecli-experimental/claude-code"}'
    exit 0
  fi

  # Guard 2: Any gh pr create MUST specify --repo jadecli-experimental/claude-code
  # because this is a fork and GitHub defaults to upstream without it
  if ! echo "$CMD" | grep -qE 'jadecli-experimental/claude-code'; then
    echo '{"decision": "block", "reason": "BLOCKED: This is a fork of anthropics/claude-code. gh pr create without --repo jadecli-experimental/claude-code will target upstream. Always use: gh pr create --repo jadecli-experimental/claude-code"}'
    exit 0
  fi
fi

# Guard 3: Block git push to any remote URL containing anthropics/claude-code
if echo "$CMD" | grep -qE 'git\s+push'; then
  if echo "$CMD" | grep -qE 'anthropics'; then
    echo '{"decision": "block", "reason": "BLOCKED: Do not push to anthropics/claude-code. Only push to jadecli-experimental/claude-code."}'
    exit 0
  fi
fi

echo '{"decision": "allow"}'
