#!/bin/bash
# Example hook that reads plugin settings from .claude/my-plugin.local.md
# Demonstrates the complete pattern for settings-driven hook behavior

set -euo pipefail

# Read hook input before resolving the project directory.
input=$(cat)
payload_cwd=$(jq -r 'if (.cwd | type) == "string" then .cwd else empty end' <<<"$input")

if [[ -n "${CLAUDE_PROJECT_DIR:-}" ]] && [[ -d "$CLAUDE_PROJECT_DIR" ]]; then
  project_root="$CLAUDE_PROJECT_DIR"
elif [[ -n "$payload_cwd" ]] && [[ -d "$payload_cwd" ]]; then
  project_root=$(git -C "$payload_cwd" rev-parse --show-toplevel 2>/dev/null || printf '%s' "$payload_cwd")
else
  project_root=$(git rev-parse --show-toplevel 2>/dev/null || pwd)
fi

SETTINGS_FILE="$project_root/.claude/my-plugin.local.md"
SCRIPT_DIR=$(cd -- "$(dirname -- "${BASH_SOURCE[0]}")" && pwd)
PARSER="$SCRIPT_DIR/../scripts/parse-frontmatter.sh"

# Quick exit if settings file doesn't exist
if [[ ! -f "$SETTINGS_FILE" ]]; then
  # Plugin not configured - use defaults or skip
  exit 0
fi

read_setting() {
  local field="$1"
  local default_value="$2"
  local value

  if value=$("$PARSER" "$SETTINGS_FILE" "$field" 2>/dev/null) &&
    [[ -n "$value" ]] && [[ "$value" != "null" ]]; then
    printf '%s' "$value"
  else
    printf '%s' "$default_value"
  fi
}

ENABLED=$(read_setting enabled false)
STRICT_MODE=$(read_setting strict_mode false)
MAX_SIZE=$(read_setting max_file_size "")

# Quick exit if disabled
if [[ "$ENABLED" != "true" ]]; then
  exit 0
fi

file_path=$(jq -r '.tool_input.file_path // empty' <<<"$input")

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
  content=$(jq -r '.tool_input.content // empty' <<<"$input")
  content_size=${#content}

  if [[ $content_size -gt $MAX_SIZE ]]; then
    echo '{"hookSpecificOutput": {"permissionDecision": "deny"}, "systemMessage": "File exceeds configured max size: '"$MAX_SIZE"' bytes"}' >&2
    exit 2
  fi
fi

# All checks passed
exit 0
