#!/bin/bash

# Ralph Wiggum Session Start Hook
# Extracts session_id from hook input and persists it as CLAUDE_SESSION_ID
# This makes the session ID available to command scripts via environment variable

set -euo pipefail

# Read hook input from stdin
HOOK_INPUT=$(cat)

# Extract session_id from hook input
SESSION_ID=$(echo "$HOOK_INPUT" | jq -r '.session_id // empty')

if [[ -z "$SESSION_ID" ]]; then
  # No session ID available - this shouldn't happen but exit gracefully
  exit 0
fi

# CLAUDE_ENV_FILE is provided by Claude Code for SessionStart hooks
# Writing to this file persists environment variables for the session
if [[ -n "${CLAUDE_ENV_FILE:-}" ]]; then
  echo "export CLAUDE_SESSION_ID=\"$SESSION_ID\"" >> "$CLAUDE_ENV_FILE"
fi

exit 0
