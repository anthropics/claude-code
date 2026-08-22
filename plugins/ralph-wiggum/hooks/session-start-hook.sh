#!/bin/bash

# Ralph Wiggum Session Start Hook
# Captures session_id and exports it for use by setup-ralph-loop.sh

set -euo pipefail

HOOK_INPUT=$(cat)
SESSION_ID=$(echo "$HOOK_INPUT" | jq -r '.session_id // empty')

if [[ -n "$SESSION_ID" ]] && [[ -n "${CLAUDE_ENV_FILE:-}" ]]; then
  echo "export CLAUDE_SESSION_ID='$SESSION_ID'" >> "$CLAUDE_ENV_FILE"
fi

exit 0
