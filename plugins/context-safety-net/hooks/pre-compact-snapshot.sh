# #!/usr/bin/env bash
# set -euo pipefail

# # pre-compact-snapshot.sh
# # Runs before auto-compaction to capture git state
# # Input: JSON on stdin with { "session_id": "..." }
# # Output: Creates snapshot directory at ~/.claude/context-safety-net/<session_id>/<timestamp>_auto/

# # Read session_id from stdin
# INPUT=$(cat)
# SESSION_ID=$(echo "$INPUT" | jq -r '.session_id // empty')

# if [[ -z "$SESSION_ID" ]]; then
#     echo "Error: No session_id provided" >&2
#     exit 1
# fi

# # Verify we're in a git repo
# if ! git rev-parse --git-dir >/dev/null 2>&1; then
#     echo "Error: Not a git repository" >&2
#     exit 1
# fi

# # Create snapshot directory
# TIMESTAMP=$(date '+%Y%m%d_%H%M%S')
# SNAPSHOT_DIR="$HOME/.claude/context-safety-net/$SESSION_ID/${TIMESTAMP}_auto"
# mkdir -p "$SNAPSHOT_DIR"

# # Capture git state
# git diff > "$SNAPSHOT_DIR/working.diff"
# git ls-files > "$SNAPSHOT_DIR/tracked-files.txt"
# git rev-parse HEAD > "$SNAPSHOT_DIR/commit.txt"

# # Copy anchors config if it exists
# ANCHORS_FILE="$PWD/.claude/context-anchors.json"
# if [[ -f "$ANCHORS_FILE" ]]; then
#     cp "$ANCHORS_FILE" "$SNAPSHOT_DIR/anchors.json"
# else
#     echo '{"version": 1, "anchors": []}' > "$SNAPSHOT_DIR/anchors.json"
# fi

# # Write metadata
# cat > "$SNAPSHOT_DIR/metadata.json" <<EOF
# {
#   "version": 1,
#   "timestamp": "$(date -Iseconds)",
#   "session_id": "$SESSION_ID",
#   "type": "auto",
#   "name": null,
#   "git_commit": "$(cat "$SNAPSHOT_DIR/commit.txt")",
#   "diff_size_bytes": $(stat -c%s "$SNAPSHOT_DIR/working.diff" 2>/dev/null || stat -f%z "$SNAPSHOT_DIR/working.diff" 2>/dev/null || echo 0)
# }
# EOF

# exit 0



#!/usr/bin/env bash
set -euo pipefail

# Read stdin JSON without jq (Windows Git Bash compatible)
INPUT=$(cat)
SESSION_ID=$(echo "$INPUT" | grep -o '"session_id"[[:space:]]*:[[:space:]]*"[^"]*"' | sed 's/.*:[[:space:]]*"//;s/"$//')

if [[ -z "$SESSION_ID" ]]; then
    # If no session ID, fallback to a default test folder
    SESSION_ID="unknown-session"
fi

# Verify we're in a git repo
if ! git rev-parse --git-dir >/dev/null 2>&1; then
    echo "Error: Not a git repository" >&2
    exit 0
fi

# Create snapshot directory
TIMESTAMP=$(date '+%Y%m%d_%H%M%S')
SNAPSHOT_DIR="$HOME/.claude/context-safety-net/$SESSION_ID/${TIMESTAMP}_auto"
mkdir -p "$SNAPSHOT_DIR"

# Capture git state (Read-only)
git diff > "$SNAPSHOT_DIR/working.diff"
git ls-files > "$SNAPSHOT_DIR/tracked-files.txt"
git rev-parse HEAD > "$SNAPSHOT_DIR/commit.txt"

# Copy anchors config if it exists
ANCHORS_FILE="$PWD/.claude/context-anchors.json"
if [[ -f "$ANCHORS_FILE" ]]; then
    cp "$ANCHORS_FILE" "$SNAPSHOT_DIR/anchors.json"
else
    echo '{"version": 1, "anchors": []}' > "$SNAPSHOT_DIR/anchors.json"
fi

# Write metadata
COMMIT_HASH=$(cat "$SNAPSHOT_DIR/commit.txt")
cat > "$SNAPSHOT_DIR/metadata.json" <<EOF
{
  "version": 1,
  "timestamp": "$(date -Iseconds)",
  "session_id": "$SESSION_ID",
  "type": "auto",
  "name": null,
  "git_commit": "$COMMIT_HASH"
}
EOF

exit 0