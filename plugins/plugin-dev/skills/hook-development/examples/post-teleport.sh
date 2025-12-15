#!/bin/bash
# Example PostTeleport hook for setting up environment after teleporting
# This script pulls changes, installs dependencies, and starts dev server

set -euo pipefail

# Navigate to project directory
cd "$CLAUDE_PROJECT_DIR" || exit 0

echo "Setting up environment after teleport..."

# Pull latest changes if in a git repository
if [ -d ".git" ]; then
  current_branch=$(git branch --show-current)
  echo "🔄 Pulling latest changes for branch: $current_branch"
  git pull origin "$current_branch" 2>/dev/null || echo "Could not pull (may be offline or no upstream)"

  # Check for stashed changes from pre-teleport
  if git stash list | grep -q "pre-teleport-stash"; then
    echo "📦 Restoring stashed changes from pre-teleport..."
    git stash pop || echo "Could not restore stash (may have conflicts)"
  fi
fi

# Install dependencies based on project type
if [ -f "package.json" ]; then
  echo "📦 Installing Node.js dependencies..."
  npm install --silent 2>/dev/null || npm install
fi

if [ -f "requirements.txt" ]; then
  echo "🐍 Installing Python dependencies..."
  pip install -r requirements.txt --quiet 2>/dev/null || pip install -r requirements.txt
fi

if [ -f "Cargo.toml" ]; then
  echo "🦀 Building Rust project..."
  cargo build 2>/dev/null || true
fi

# Start development server if available
if [ -f "package.json" ]; then
  # Check for common dev server scripts
  if grep -q '"dev:staging"' package.json; then
    echo "🚀 Starting staging dev server..."
    npm run dev:staging &
  elif grep -q '"dev"' package.json; then
    echo "🚀 Starting dev server..."
    npm run dev &
  elif grep -q '"start"' package.json; then
    echo "🚀 Starting server..."
    npm start &
  fi
fi

echo "✅ Teleport complete! Environment ready."
exit 0
