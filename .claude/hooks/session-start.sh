#!/bin/bash
set -euo pipefail

# Only run in remote (web) environments
if [ "${CLAUDE_CODE_REMOTE:-}" != "true" ]; then
  exit 0
fi

REPO_DIR="${CLAUDE_PROJECT_DIR:-.}"
cd "$REPO_DIR"

# === Install gh CLI if missing ===
if ! command -v gh &>/dev/null; then
  echo "[session-start] Installing gh CLI..."
  GH_VERSION="2.65.0"
  curl -sL "https://github.com/cli/cli/releases/download/v${GH_VERSION}/gh_${GH_VERSION}_linux_amd64.tar.gz" \
    | tar xz -C /usr/local/bin --strip-components=2 "gh_${GH_VERSION}_linux_amd64/bin/gh" 2>/dev/null || true
fi

# === Authenticate gh CLI from GH_TOKEN env var ===
# Set GH_TOKEN in your environment or Claude Code secrets to enable gh auth.
# If GH_TOKEN is already set, gh CLI uses it automatically (no explicit login needed).
if [ -n "${GH_TOKEN:-}" ]; then
  echo "[session-start] GH_TOKEN detected, gh CLI will use it for authentication."
elif [ -n "${GITHUB_TOKEN:-}" ]; then
  # Fall back to GITHUB_TOKEN if GH_TOKEN isn't set
  export GH_TOKEN="${GITHUB_TOKEN}"
  echo "[session-start] GITHUB_TOKEN detected, exporting as GH_TOKEN for gh CLI."
  echo "export GH_TOKEN=\"${GITHUB_TOKEN}\"" >> "${CLAUDE_ENV_FILE:-/dev/null}"
else
  echo "[session-start] WARNING: No GH_TOKEN or GITHUB_TOKEN found. gh CLI commands (PR creation) will fail."
  echo "[session-start] Set GH_TOKEN as a secret or env var to enable PR creation."
fi

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
