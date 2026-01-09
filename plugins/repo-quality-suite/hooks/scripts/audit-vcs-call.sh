#!/bin/bash
# audit-vcs-call.sh - Audit VCS API calls (GitHub/GitLab/Bitbucket)
# Logs API operations for security and debugging

INPUT=$(cat)
TOOL_NAME=$(echo "$INPUT" | jq -r '.tool_name // ""')
SESSION_ID=$(echo "$INPUT" | jq -r '.session_id // "unknown"')
TIMESTAMP=$(date -u +"%Y-%m-%dT%H:%M:%SZ")

# Extract VCS platform from tool name
PLATFORM=""
if [[ "$TOOL_NAME" =~ mcp__github__ ]]; then
    PLATFORM="github"
elif [[ "$TOOL_NAME" =~ mcp__gitlab__ ]]; then
    PLATFORM="gitlab"
elif [[ "$TOOL_NAME" =~ mcp__bitbucket__ ]]; then
    PLATFORM="bitbucket"
else
    exit 0
fi

# Log the API call
LOG_DIR="${CLAUDE_PROJECT_DIR:-.}/.claude/logs"
mkdir -p "$LOG_DIR"
LOG_FILE="$LOG_DIR/vcs-audit.log"

echo "[$TIMESTAMP] session=$SESSION_ID platform=$PLATFORM tool=$TOOL_NAME" >> "$LOG_FILE"

exit 0
