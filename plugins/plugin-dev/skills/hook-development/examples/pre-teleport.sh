#!/bin/bash
# Example PreTeleport hook for preparing environment before teleporting
# This script stashes uncommitted changes and saves state for restoration

set -euo pipefail

# Navigate to project directory
cd "$CLAUDE_PROJECT_DIR" || exit 0

echo "Preparing for teleport..."

# Check if we're in a git repository
if [ ! -d ".git" ]; then
  echo "Not a git repository, skipping pre-teleport preparation"
  exit 0
fi

# Stash uncommitted changes before teleporting
if [ -n "$(git status --porcelain)" ]; then
  echo "📦 Stashing uncommitted changes before teleport..."
  git stash push -m "pre-teleport-stash-$(date +%s)"
  echo "Changes stashed successfully"
else
  echo "No uncommitted changes to stash"
fi

# Save current branch state for post-teleport restoration
mkdir -p .claude
echo "$(git branch --show-current)" > .claude/.teleport-state
echo "Current branch saved: $(cat .claude/.teleport-state)"

echo "Pre-teleport preparation complete"
exit 0
