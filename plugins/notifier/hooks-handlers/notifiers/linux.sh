#!/bin/bash
# linux.sh - Linux notification using notify-send
# Called from notify.sh

set -e

# Check if notify-send is available
if ! command -v notify-send &> /dev/null; then
    exit 0
fi

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
source "$SCRIPT_DIR/../common.sh"

# Read config from environment or use defaults
MIN_DURATION=${MIN_DURATION_SECONDS:-20}
NOTIFY_MSG=${NOTIFY_MESSAGE:-"Task completed!"}
NOTIF_TYPE=${NOTIFICATION_TYPE:-""}

# Read stdin (JSON from Claude Code)
INPUT=$(cat)

SESSION_ID=$(get_session_id "$INPUT")

# For Notification hooks (permission_prompt, idle_prompt), show immediately
if [ -n "$NOTIF_TYPE" ] && [ "$NOTIF_TYPE" != "null" ]; then
    notify-send "Claude Code" "$NOTIFY_MSG"
    exit 0
fi

# Stop hook: check duration threshold
if ! should_notify "$SESSION_ID" "$MIN_DURATION"; then
    exit 0
fi

# Get prompt preview and show notification
PROMPT_TEXT=$(get_prompt_text "$SESSION_ID")

if [ -n "$PROMPT_TEXT" ]; then
    notify-send "Claude Code" "$NOTIFY_MSG\n$PROMPT_TEXT"
else
    notify-send "Claude Code" "$NOTIFY_MSG"
fi

exit 0
