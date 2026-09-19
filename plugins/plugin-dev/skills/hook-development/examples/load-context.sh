#!/bin/bash
# Example SessionStart hook for loading project context
# This script detects project type and sets environment variables

set -euo pipefail

# Navigate to project directory
cd "$CLAUDE_PROJECT_DIR" || exit 1

# SessionStart hooks persist env via CLAUDE_ENV_FILE. Require a real path and
# refuse symlinks so a planted link cannot redirect writes into credential files.
if [[ -z "${CLAUDE_ENV_FILE:-}" ]]; then
  echo "CLAUDE_ENV_FILE is not set; skipping env persistence" >&2
  exit 0
fi
if [[ -L "$CLAUDE_ENV_FILE" ]]; then
  echo "Refusing to write through symlink CLAUDE_ENV_FILE=$CLAUDE_ENV_FILE" >&2
  exit 1
fi

echo "Loading project context..."

# Detect project type and set environment
if [ -f "package.json" ]; then
  echo "📦 Node.js project detected"
  echo "export PROJECT_TYPE=nodejs" >> "$CLAUDE_ENV_FILE"

  # Check if TypeScript
  if [ -f "tsconfig.json" ]; then
    echo "export USES_TYPESCRIPT=true" >> "$CLAUDE_ENV_FILE"
  fi

elif [ -f "Cargo.toml" ]; then
  echo "🦀 Rust project detected"
  echo "export PROJECT_TYPE=rust" >> "$CLAUDE_ENV_FILE"

elif [ -f "go.mod" ]; then
  echo "🐹 Go project detected"
  echo "export PROJECT_TYPE=go" >> "$CLAUDE_ENV_FILE"

elif [ -f "pyproject.toml" ] || [ -f "setup.py" ]; then
  echo "🐍 Python project detected"
  echo "export PROJECT_TYPE=python" >> "$CLAUDE_ENV_FILE"

elif [ -f "pom.xml" ]; then
  echo "☕ Java (Maven) project detected"
  echo "export PROJECT_TYPE=java" >> "$CLAUDE_ENV_FILE"
  echo "export BUILD_SYSTEM=maven" >> "$CLAUDE_ENV_FILE"

elif [ -f "build.gradle" ] || [ -f "build.gradle.kts" ]; then
  echo "☕ Java/Kotlin (Gradle) project detected"
  echo "export PROJECT_TYPE=java" >> "$CLAUDE_ENV_FILE"
  echo "export BUILD_SYSTEM=gradle" >> "$CLAUDE_ENV_FILE"

else
  echo "❓ Unknown project type"
  echo "export PROJECT_TYPE=unknown" >> "$CLAUDE_ENV_FILE"
fi

# Check for CI configuration
if [ -f ".github/workflows" ] || [ -f ".gitlab-ci.yml" ] || [ -f ".circleci/config.yml" ]; then
  echo "export HAS_CI=true" >> "$CLAUDE_ENV_FILE"
fi

echo "Project context loaded successfully"
exit 0
