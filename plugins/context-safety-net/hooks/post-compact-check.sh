# #!/usr/bin/env bash
# set -euo pipefail

# # post-compact-check.sh
# # Runs after auto-compaction to check if anchor files are still tracked
# # Input: JSON on stdin with { "session_id": "..." }
# # Output: Warning to stdout if anchors missing; otherwise silent exit 0

# # Read session_id from stdin
# INPUT=$(cat)
# SESSION_ID=$(echo "$INPUT" | jq -r '.session_id // empty')

# if [[ -z "$SESSION_ID" ]]; then
#     echo "Error: No session_id provided" >&2
#     exit 1
# fi

# SNAPSHOT_BASE="$HOME/.claude/context-safety-net/$SESSION_ID"

# # Find latest auto snapshot
# LATEST_SNAPSHOT=$(ls -td "$SNAPSHOT_BASE"/*_auto 2>/dev/null | head -n1)

# if [[ -z "$LATEST_SNAPSHOT" || ! -d "$LATEST_SNAPSHOT" ]]; then
#     exit 0
# fi

# ANCHORS_FILE="$LATEST_SNAPSHOT/anchors.json"

# if [[ ! -f "$ANCHORS_FILE" ]]; then
#     exit 0
# fi

# # Check if we're in a git repo
# if ! git rev-parse --git-dir >/dev/null 2>&1; then
#     exit 0
# fi

# # Get current tracked files
# CURRENT_FILES=$(git ls-files)

# # Extract anchor paths from anchors.json
# MISSING_ANCHORS=()
# while IFS= read -r anchor_path; do
#     if [[ -n "$anchor_path" ]]; then
#         if ! echo "$CURRENT_FILES" | grep -qxF "$anchor_path"; then
#             MISSING_ANCHORS+=("$anchor_path")
#         fi
#     fi
# done < <(jq -r '.anchors[].path' "$ANCHORS_FILE")

# # Output warning if any anchors missing
# if [[ ${#MISSING_ANCHORS[@]} -gt 0 ]]; then
#     echo "⚠️ Context Safety Net Warning"
#     echo "Anchor files missing from working directory:"
#     for anchor in "${MISSING_ANCHORS[@]}"; do
#         echo "$anchor"
#     done
#     echo "Run /project:restore <snapshot_name> to reload context."
# fi

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

# Find latest auto snapshot
LATEST_SNAPSHOT=$(ls -td "$SNAPSHOT_BASE"/*_auto 2>/dev/null | head -n1)

if [[ -z "$LATEST_SNAPSHOT" || ! -d "$LATEST_SNAPSHOT" ]]; then
    exit 0
fi

ANCHORS_FILE="$LATEST_SNAPSHOT/anchors.json"

if [[ ! -f "$ANCHORS_FILE" ]]; then
    exit 0
fi

# Check if we're in a git repo
if ! git rev-parse --git-dir >/dev/null 2>&1; then
    exit 0
fi

# Get current tracked files
CURRENT_FILES=$(git ls-files)

# Extract anchor paths without jq
MISSING_ANCHORS=()
while IFS= read -r anchor_path; do
    if [[ -n "$anchor_path" ]]; then
        if ! echo "$CURRENT_FILES" | grep -qxF "$anchor_path"; then
            MISSING_ANCHORS+=("$anchor_path")
        fi
    fi
done < <(grep -o '"path"[[:space:]]*:[[:space:]]*"[^"]*"' "$ANCHORS_FILE" | sed 's/.*:[[:space:]]*"//;s/"$//')

# Output warning if any anchors missing
if [[ ${#MISSING_ANCHORS[@]} -gt 0 ]]; then
    echo "⚠️ Context Safety Net Warning"
    echo "Anchor files missing from working directory:"
    for anchor in "${MISSING_ANCHORS[@]}"; do
        echo "- $anchor"
    done
    echo "Run /project:restore <snapshot_name> to reload context."
fi

exit 0