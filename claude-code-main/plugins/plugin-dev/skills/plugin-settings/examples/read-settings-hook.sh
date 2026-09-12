#!/bin/bash
# Example hook that reads plugin settings from .claude/my-plugin.local.md
# Demonstrates the complete pattern for settings-driven hook behavior

set -euo pipefail

# Define settings file path
SETTINGS_FILE=".claude/my-plugin.local.md"

# Quick exit if settings file doesn't exist
if [[ ! -f "$SETTINGS_FILE" ]]; then
  # Plugin not configured - use defaults or skip
  exit 0
fi

# Parse YAML frontmatter (everything between --- markers)
FRONTMATTER=$(sed -n '/^---$/,/^---$/{ /^---$/d; p; }' "$SETTINGS_FILE")

# Extract configuration fields
ENABLED=$(echo "$FRONTMATTER" | grep '^enabled:' | sed 's/enabled: *//' | sed 's/^"\(.*\)"$/\1/')
STRICT_MODE=$(echo "$FRONTMATTER" | grep '^strict_mode:' | sed 's/strict_mode: *//' | sed 's/^"\(.*\)"$/\1/')
MAX_SIZE=$(echo "$FRONTMATTER" | grep '^max_file_size:' | sed 's/max_file_size: *//')

# Quick exit if disabled
if [[ "$ENABLED" != "true" ]]; then
  exit 0
fi

# Read hook input
input=$(cat)
file_path=$(echo "$input" | jq -r '.tool_input.file_path // empty')

# Apply configured validation
if [[ "$STRICT_MODE" == "true" ]]; then
  # Strict mode: apply all checks
  if [[ "$file_path" == *".."* ]]; then
    echo '{"hookSpecificOutput": {"permissionDecision": "deny"}, "systemMessage": "Path traversal blocked (strict mode)"}' >&2
    exit 2
  fi

  if [[ "$file_path" == *".env"* ]] || [[ "$file_path" == *"secret"* ]]; then
    echo '{"hookSpecificOutput": {"permissionDecision": "deny"}, "systemMessage": "Sensitive file blocked (strict mode)"}' >&2
    exit 2
  fi
else
  # Standard mode: basic checks only
  if [[ "$file_path" == "/etc/"* ]] || [[ "$file_path" == "/sys/"* ]]; then
    echo '{"hookSpecificOutput": {"permissionDecision": "deny"}, "systemMessage": "System path blocked"}' >&2
    exit 2
  fi
fi

# Check file size if configured
if [[ -n "$MAX_SIZE" ]] && [[ "$MAX_SIZE" =~ ^[0-9]+$ ]]; then
  content=$(echo "$input" | jq -r '.tool_input.content // empty')
  content_size=${#content}

  if [[ $content_size -gt $MAX_SIZE ]]; then
    echo '{"hookSpecificOutput": {"permissionDecision": "deny"}, "systemMessage": "File exceeds configured max size: '"$MAX_SIZE"' bytes"}' >&2
    exit 2
  fi
fi

# All checks passed
exit 0
