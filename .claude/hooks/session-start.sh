#!/bin/bash
set -euo pipefail

# Only run in remote (web) environments
if [ "${CLAUDE_CODE_REMOTE:-}" != "true" ]; then
  exit 0
fi

REPO_DIR="${CLAUDE_PROJECT_DIR:-.}"
cd "$REPO_DIR"

# === Git Remote Protection ===
# Ensure 'origin' always points to the fork, never the upstream anthropics repo.
# This prevents accidental PRs or pushes to https://github.com/anthropics/claude-code.

FORK_OWNER="jadecli-experimental"
FORK_REPO="claude-code"
UPSTREAM_OWNER="anthropics"

current_origin=$(git remote get-url origin 2>/dev/null || echo "")

# If origin currently points at anthropics, rewrite it to the fork
if echo "$current_origin" | grep -qi "${UPSTREAM_OWNER}/${FORK_REPO}"; then
  echo "[session-start] Rewriting origin from upstream (${UPSTREAM_OWNER}) to fork (${FORK_OWNER})"
  git remote set-url origin "https://github.com/${FORK_OWNER}/${FORK_REPO}.git"
  git remote set-url --push origin "https://github.com/${FORK_OWNER}/${FORK_REPO}.git"
fi

# Always enforce push URL to the fork regardless of fetch URL
# (handles proxy URLs in cloud environments)
PUSH_URL=$(git remote get-url --push origin 2>/dev/null || echo "")
if echo "$PUSH_URL" | grep -qi "${UPSTREAM_OWNER}/${FORK_REPO}"; then
  echo "[session-start] Overriding push URL to fork"
  git remote set-url --push origin "https://github.com/${FORK_OWNER}/${FORK_REPO}.git"
fi

# Add upstream as a separate read-only remote for fetching, if not already present
if ! git remote get-url upstream &>/dev/null; then
  echo "[session-start] Adding read-only 'upstream' remote for ${UPSTREAM_OWNER}/${FORK_REPO}"
  git remote add upstream "https://github.com/${UPSTREAM_OWNER}/${FORK_REPO}.git"
  # Disable push to upstream to prevent accidents
  git remote set-url --push upstream DISABLE_PUSH_TO_UPSTREAM
fi

# Configure gh CLI to default PRs to the fork, not upstream
if command -v gh &>/dev/null; then
  git config --local remote.pushDefault origin
  # Set the default repo for gh commands to the fork
  gh repo set-default "${FORK_OWNER}/${FORK_REPO}" 2>/dev/null || true
fi

echo "[session-start] Git remotes configured. PRs will target ${FORK_OWNER}/${FORK_REPO}."
git remote -v
