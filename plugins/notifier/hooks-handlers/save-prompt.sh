#!/bin/bash
# save-prompt.sh - Saves user prompt and timestamp for notifications
# Hook: UserPromptSubmit

set -e

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
source "$SCRIPT_DIR/common.sh"
source "$SCRIPT_DIR/config.sh"

# Ensure data directory exists
mkdir -p "$DATA_DIR"

# Read stdin (JSON from Claude Code)
INPUT=$(cat)

SESSION_ID=$(get_session_id "$INPUT")
PROMPT=$(json_get "$INPUT" "prompt")

# Exit silently if no prompt
if [ -z "$PROMPT" ]; then
    exit 0
fi

# Format prompt preview
LENGTH=${#PROMPT}
if [ "$LENGTH" -le "$PROMPT_PREVIEW_LENGTH" ]; then
    FORMATTED_PROMPT="$PROMPT"
else
    FORMATTED_PROMPT="${PROMPT:0:$PROMPT_PREVIEW_LENGTH}..."
fi

# Save prompt and timestamp
echo "$FORMATTED_PROMPT" > "$DATA_DIR/prompt-${SESSION_ID}.txt"
date +%s > "$DATA_DIR/timestamp-${SESSION_ID}.txt"

exit 0
