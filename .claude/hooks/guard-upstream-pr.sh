#!/usr/bin/env bash
# Guard hook: Prevents PRs and pushes targeting anthropics/claude-code (upstream).
# All PRs should target jadecli-experimental/claude-code (fork).

set -euo pipefail

INPUT=$(cat)
CMD=$(echo "$INPUT" | jq -r '.tool_input.command // empty')

# Guard 1: Block any gh pr create that explicitly targets anthropics/claude-code
if echo "$CMD" | grep -qE 'gh\s+pr\s+create'; then
  if echo "$CMD" | grep -qE 'anthropics/claude-code'; then
    echo '{"decision": "block", "reason": "BLOCKED: Do not create PRs against anthropics/claude-code (upstream). Target your fork jadecli-experimental/claude-code instead. Use: gh pr create --repo jadecli-experimental/claude-code"}'
    exit 0
  fi

  # Guard 2: If gh pr create is called without --repo, check that origin isn't anthropics
  if ! echo "$CMD" | grep -qE '\-\-repo|\-R\s'; then
    ORIGIN_URL=$(git remote get-url origin 2>/dev/null || echo "")
    if echo "$ORIGIN_URL" | grep -qE 'anthropics/claude-code'; then
      echo '{"decision": "block", "reason": "BLOCKED: origin remote points to anthropics/claude-code. PRs would target upstream. Use: gh pr create --repo jadecli-experimental/claude-code"}'
      exit 0
    fi
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
