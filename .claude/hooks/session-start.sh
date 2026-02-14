#!/bin/bash
set -euo pipefail

# Git Remote Protection Hook
# Ensures origin always points to the fork (jadecli-experimental/claude-code)
# and never to the upstream (anthropics/claude-code), preventing accidental PRs.

FORK_OWNER="jadecli-experimental"
FORK_REPO="claude-code"
UPSTREAM_OWNER="anthropics"

CURRENT_ORIGIN=$(git remote get-url origin 2>/dev/null || echo "")

# Check if origin points to the upstream repo
if echo "$CURRENT_ORIGIN" | grep -qi "${UPSTREAM_OWNER}/${FORK_REPO}"; then
  echo "WARNING: origin points to upstream (${UPSTREAM_OWNER}/${FORK_REPO}). Reconfiguring..."

  # Preserve upstream as a named remote before overwriting
  if ! git remote get-url upstream &>/dev/null; then
    git remote add upstream "$CURRENT_ORIGIN"
    echo "Saved upstream remote: $CURRENT_ORIGIN"
  fi

  # Determine the correct fork URL format (match current protocol)
  if echo "$CURRENT_ORIGIN" | grep -q "^https://"; then
    FORK_URL="https://github.com/${FORK_OWNER}/${FORK_REPO}.git"
  elif echo "$CURRENT_ORIGIN" | grep -q "^git@"; then
    FORK_URL="git@github.com:${FORK_OWNER}/${FORK_REPO}.git"
  elif echo "$CURRENT_ORIGIN" | grep -q "127.0.0.1"; then
    # Claude Code web proxy format - rewrite the path portion only
    FORK_URL=$(echo "$CURRENT_ORIGIN" | sed "s|/git/${UPSTREAM_OWNER}/|/git/${FORK_OWNER}/|")
  else
    FORK_URL="https://github.com/${FORK_OWNER}/${FORK_REPO}.git"
  fi

  git remote set-url origin "$FORK_URL"
  echo "origin now points to fork: $FORK_URL"
else
  echo "origin OK: points to ${FORK_OWNER}/${FORK_REPO}"
fi

# Verify final state
FINAL_ORIGIN=$(git remote get-url origin)
if echo "$FINAL_ORIGIN" | grep -qi "${UPSTREAM_OWNER}/${FORK_REPO}"; then
  echo "ERROR: Failed to redirect origin away from upstream. Aborting."
  exit 1
fi

echo "Git remote protection verified."
