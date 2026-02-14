#!/usr/bin/env bash
# SessionStart hook: Auto-configures gh CLI auth and fork defaults.
#
# Requires GH_TOKEN environment variable to be set (e.g. a GitHub PAT).
# Also installs gh if missing, authenticates, and sets the default repo
# to the fork so PRs never accidentally target upstream.

set -euo pipefail

FORK_REPO="jadecli-experimental/claude-code"
LOG_PREFIX="[session-start-gh-setup]"

# Install gh if not present
if ! command -v gh &>/dev/null; then
  GH_VERSION=$(curl -sL https://api.github.com/repos/cli/cli/releases/latest | jq -r '.tag_name' | sed 's/^v//')
  if [ -n "$GH_VERSION" ]; then
    curl -sL "https://github.com/cli/cli/releases/download/v${GH_VERSION}/gh_${GH_VERSION}_linux_amd64.tar.gz" -o /tmp/gh.tar.gz
    tar -xzf /tmp/gh.tar.gz -C /tmp
    cp "/tmp/gh_${GH_VERSION}_linux_amd64/bin/gh" /usr/local/bin/gh
    chmod +x /usr/local/bin/gh
    rm -rf /tmp/gh.tar.gz "/tmp/gh_${GH_VERSION}_linux_amd64"
    echo "${LOG_PREFIX} Installed gh $(gh --version | head -1)" >&2
  else
    echo "${LOG_PREFIX} WARNING: Could not determine latest gh version, skipping install" >&2
  fi
fi

# Authenticate gh from GH_TOKEN env var
if command -v gh &>/dev/null; then
  if [ -n "${GH_TOKEN:-}" ]; then
    if ! gh auth status &>/dev/null; then
      echo "$GH_TOKEN" | gh auth login --with-token 2>/dev/null
      echo "${LOG_PREFIX} Authenticated gh CLI from GH_TOKEN" >&2
    fi

    # Set default repo to fork so gh pr create targets the fork, not upstream
    gh repo set-default "$FORK_REPO" 2>/dev/null || true
    echo "${LOG_PREFIX} Default repo set to ${FORK_REPO}" >&2
  else
    echo "${LOG_PREFIX} WARNING: GH_TOKEN not set. gh CLI will not be authenticated. Set GH_TOKEN env var to a GitHub PAT." >&2
  fi
fi
