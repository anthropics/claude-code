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

# ─── GitHub CLI Authentication ───
# Authenticates gh CLI from GITHUB_TOKEN env var if available.
# Set GITHUB_TOKEN in your environment or in $CLAUDE_ENV_FILE to enable.

if command -v gh &>/dev/null; then
  if ! gh auth status &>/dev/null; then
    if [ -n "${GITHUB_TOKEN:-}" ]; then
      echo "$GITHUB_TOKEN" | gh auth login --with-token 2>&1
      echo "gh CLI authenticated via GITHUB_TOKEN"
    elif [ -n "${GH_TOKEN:-}" ]; then
      echo "$GH_TOKEN" | gh auth login --with-token 2>&1
      echo "gh CLI authenticated via GH_TOKEN"
    else
      echo "gh CLI not authenticated. Set GITHUB_TOKEN or GH_TOKEN env var to enable."
      echo "  export GITHUB_TOKEN=ghp_... >> \$CLAUDE_ENV_FILE"
    fi
  else
    echo "gh CLI already authenticated."
  fi

  # Ensure gh defaults to the fork for PRs
  gh repo set-default "${FORK_OWNER}/${FORK_REPO}" 2>/dev/null || true
else
  echo "gh CLI not installed. Install with: apt-get install -y gh"
fi
