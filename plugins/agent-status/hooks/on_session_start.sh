#!/usr/bin/env bash
# SessionStart hook: saves current session_id + cwd to a known file
# so agent-status.py can find the right session without guessing.
#
# Receives JSON on stdin:
#   {"session_id": "d4e48215-...", "cwd": "/home/user/project", ...}
#
# Writes to:
#   ~/.claude/agent-status/current-session.json

set -euo pipefail

PAYLOAD=$(cat)

SESSION_ID=$(echo "$PAYLOAD" | python3 -c "import sys,json; print(json.load(sys.stdin).get('session_id',''))" 2>/dev/null)
CWD=$(echo "$PAYLOAD" | python3 -c "import sys,json; print(json.load(sys.stdin).get('cwd',''))" 2>/dev/null)

# Only write if we got a session_id
if [[ -n "$SESSION_ID" ]]; then
    MARKER_DIR="${HOME}/.claude/agent-status"
    mkdir -p "$MARKER_DIR"
    cat > "$MARKER_DIR/current-session.json" <<EOF
{"session_id": "$SESSION_ID", "cwd": "$CWD", "timestamp": "$(date -u +%Y-%m-%dT%H:%M:%SZ)"}
EOF
fi

exit 0
