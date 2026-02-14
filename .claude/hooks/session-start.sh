#!/bin/bash
set -euo pipefail

# Only run in remote (Claude Code on the web) environments
if [ "${CLAUDE_CODE_REMOTE:-}" != "true" ]; then
  exit 0
fi

FORK_OWNER="jadecli-experimental"
FORK_REPO="claude-code"
FORK_URL="https://github.com/${FORK_OWNER}/${FORK_REPO}"
UPSTREAM_OWNER="anthropics"

# Configure gh CLI to target the fork (not upstream) for PR creation
# This prevents `gh pr create` from defaulting to the upstream parent repo
git config --local remote.origin.gh-resolved "${FORK_OWNER}/${FORK_REPO}"

# Ensure the push remote points to the fork, not upstream
CURRENT_PUSH_URL="$(git remote get-url --push origin 2>/dev/null || echo "")"
if echo "$CURRENT_PUSH_URL" | grep -qi "${UPSTREAM_OWNER}/${FORK_REPO}"; then
  echo "WARNING: origin push URL points to upstream (${UPSTREAM_OWNER}). Reconfiguring to fork."
  git remote set-url --push origin "${FORK_URL}.git"
fi

# Write a guard env var so other hooks/scripts can check
if [ -n "${CLAUDE_ENV_FILE:-}" ]; then
  echo "export GH_PR_TARGET_REPO=${FORK_OWNER}/${FORK_REPO}" >> "$CLAUDE_ENV_FILE"
  echo "export GH_PR_BLOCK_UPSTREAM=true" >> "$CLAUDE_ENV_FILE"
fi

echo "Session configured: PRs target ${FORK_URL} (not ${UPSTREAM_OWNER}/${FORK_REPO})"
