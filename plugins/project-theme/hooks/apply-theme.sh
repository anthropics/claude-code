#!/usr/bin/env bash
set -euo pipefail

# Apply per-project theme from .claude/settings.json
# Usage: Add "theme": "pink" or "color": "blue" to your project's .claude/settings.json

SETTINGS_FILE=".claude/settings.json"
SETTINGS_LOCAL_FILE=".claude/settings.local.json"

# Extract theme from JSON file using jq if available, else fallback to grep
extract_theme() {
  local file="$1"
  if [[ ! -f "$file" ]]; then
    return
  fi
  
  if command -v jq &>/dev/null; then
    # Use jq for proper JSON parsing
    jq -r '.theme // .color // empty' "$file" 2>/dev/null || true
  else
    # Fallback to grep for simple cases
    grep -o '"\(theme\|color\)"\s*:\s*"[^"]*"' "$file" 2>/dev/null | head -1 | sed 's/.*"\([^"]*\)"$/\1/' || true
  fi
}

# Check for theme in settings files (local takes precedence)
THEME=""

if [[ -f "$SETTINGS_LOCAL_FILE" ]]; then
  THEME=$(extract_theme "$SETTINGS_LOCAL_FILE")
fi

if [[ -z "$THEME" && -f "$SETTINGS_FILE" ]]; then
  THEME=$(extract_theme "$SETTINGS_FILE")
fi

if [[ -n "$THEME" ]]; then
  echo "Applying project theme: $THEME"
  # Output JSON command for Claude Code to process
  echo "{\"type\": \"theme\", \"theme\": \"$THEME\"}"
fi

exit 0
