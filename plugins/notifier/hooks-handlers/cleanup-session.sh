#!/bin/bash
# cleanup-session.sh - Cleans up session files when Claude Code session ends
# Hook: SessionEnd

set -e

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
source "$SCRIPT_DIR/common.sh"

# Read stdin (JSON from Claude Code)
INPUT=$(cat)

SESSION_ID=$(get_session_id "$INPUT")

# Clean up session files
rm -f "$DATA_DIR/prompt-${SESSION_ID}.txt"
rm -f "$DATA_DIR/timestamp-${SESSION_ID}.txt"

exit 0
