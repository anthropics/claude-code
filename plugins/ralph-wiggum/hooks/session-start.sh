#!/bin/bash

# Ralph Wiggum SessionStart Hook
# Captures the current Claude session ID for later Ralph loop setup.

set -euo pipefail

HOOK_INPUT=$(cat)
SESSION_ID=$(echo "$HOOK_INPUT" | jq -r '.session_id // ""')

if [[ -z "$SESSION_ID" ]] || [[ -z "${CLAUDE_ENV_FILE:-}" ]]; then
  exit 0
fi

TEMP_FILE="${CLAUDE_ENV_FILE}.tmp.$$"

{
  if [[ -f "$CLAUDE_ENV_FILE" ]]; then
    grep -v '^export RALPH_WIGGUM_SESSION_ID=' "$CLAUDE_ENV_FILE" || true
  fi
  echo "export RALPH_WIGGUM_SESSION_ID=\"$SESSION_ID\""
} > "$TEMP_FILE"

mv "$TEMP_FILE" "$CLAUDE_ENV_FILE"
