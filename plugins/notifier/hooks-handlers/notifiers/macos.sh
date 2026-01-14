#!/bin/bash
# macos.sh - macOS notification using AppleScript
# Called from notify.sh

set -e

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
    osascript -e "display notification \"$NOTIFY_MSG\" with title \"Claude Code\""
    exit 0
fi

# Stop hook: check duration threshold
if ! should_notify "$SESSION_ID" "$MIN_DURATION"; then
    exit 0
fi

# Get prompt preview and show notification
PROMPT_TEXT=$(get_prompt_text "$SESSION_ID")

if [ -n "$PROMPT_TEXT" ]; then
    osascript -e "display notification \"$PROMPT_TEXT\" with title \"Claude Code\" subtitle \"$NOTIFY_MSG\""
else
    osascript -e "display notification \"$NOTIFY_MSG\" with title \"Claude Code\""
fi

exit 0
