# #!/usr/bin/env bash
# set -euo pipefail

# # safety-net-hud.sh
# # Status line component showing snapshot count and time since last auto snapshot
# # Input: JSON on stdin with { "session_id": "..." }
# # Output: Status line string to stdout (e.g., "🛡️ SafetyNet: 3 snapshots (last: 5m ago)")

# INPUT=$(cat)
# SESSION_ID=$(echo "$INPUT" | jq -r '.session_id // empty')

# if [[ -z "$SESSION_ID" ]]; then
#     exit 0
# fi

# SNAPSHOT_BASE="$HOME/.claude/context-safety-net/$SESSION_ID"

# if [[ ! -d "$SNAPSHOT_BASE" ]]; then
#     echo "🛡️ SafetyNet: 0 snapshots"
#     exit 0
# fi

# # Count all snapshot directories safely
# SNAPSHOT_COUNT=$(find "$SNAPSHOT_BASE" -maxdepth 1 -mindepth 1 -type d 2>/dev/null | wc -l | tr -d ' ')

# # Find latest auto snapshot
# LATEST_AUTO=$(ls -td "$SNAPSHOT_BASE"/*_auto 2>/dev/null | head -n1)

# if [[ -z "$LATEST_AUTO" || ! -d "$LATEST_AUTO" ]]; then
#     echo "🛡️ SafetyNet: $SNAPSHOT_COUNT snapshots"
#     exit 0
# fi

# # Get modification time of latest snapshot directory (works on Linux and macOS)
# SNAPSHOT_EPOCH=$(stat -c %Y "$LATEST_AUTO" 2>/dev/null || stat -f %m "$LATEST_AUTO" 2>/dev/null || echo 0)

# if [[ "$SNAPSHOT_EPOCH" -gt 0 ]]; then
#     NOW_EPOCH=$(date +%s)
#     DIFF_SECONDS=$((NOW_EPOCH - SNAPSHOT_EPOCH))
#     MINUTES_AGO=$((DIFF_SECONDS / 60))

#     if [[ $MINUTES_AGO -lt 1 ]]; then
#         MINUTES_AGO=1
#     fi

#     echo "🛡️ SafetyNet: $SNAPSHOT_COUNT snapshots (last: ${MINUTES_AGO}m ago)"
#     exit 0
# fi

# echo "🛡️ SafetyNet: $SNAPSHOT_COUNT snapshots"
# exit 0




#!/usr/bin/env bash
set -euo pipefail

# Read stdin JSON without jq (Windows Git Bash compatible)
INPUT=$(cat)
SESSION_ID=$(echo "$INPUT" | grep -o '"session_id"[[:space:]]*:[[:space:]]*"[^"]*"' | sed 's/.*:[[:space:]]*"//;s/"$//')

if [[ -z "$SESSION_ID" ]]; then
    exit 0
fi

SNAPSHOT_BASE="$HOME/.claude/context-safety-net/$SESSION_ID"

if [[ ! -d "$SNAPSHOT_BASE" ]]; then
    echo "🛡️ SafetyNet: 0 snapshots"
    exit 0
fi

# Count all snapshot directories safely
SNAPSHOT_COUNT=$(find "$SNAPSHOT_BASE" -maxdepth 1 -mindepth 1 -type d 2>/dev/null | wc -l | tr -d ' ')

# Find latest auto snapshot
LATEST_AUTO=$(ls -td "$SNAPSHOT_BASE"/*_auto 2>/dev/null | head -n1)

if [[ -z "$LATEST_AUTO" || ! -d "$LATEST_AUTO" ]]; then
    echo "🛡️ SafetyNet: $SNAPSHOT_COUNT snapshots"
    exit 0
fi

# Get modification time of latest snapshot directory (works on Linux, macOS, and Git Bash)
SNAPSHOT_EPOCH=$(stat -c %Y "$LATEST_AUTO" 2>/dev/null || stat -f %m "$LATEST_AUTO" 2>/dev/null || echo 0)

if [[ "$SNAPSHOT_EPOCH" -gt 0 ]]; then
    NOW_EPOCH=$(date +%s)
    DIFF_SECONDS=$((NOW_EPOCH - SNAPSHOT_EPOCH))
    MINUTES_AGO=$((DIFF_SECONDS / 60))

    if [[ $MINUTES_AGO -lt 1 ]]; then
        MINUTES_AGO=1
    fi

    echo "🛡️ SafetyNet: $SNAPSHOT_COUNT snapshots (last: ${MINUTES_AGO}m ago)"
    exit 0
fi

echo "🛡️ SafetyNet: $SNAPSHOT_COUNT snapshots"
exit 0