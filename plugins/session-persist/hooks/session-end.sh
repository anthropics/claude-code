#!/usr/bin/env bash
set -euo pipefail

SESSION_ID="${CLAUDE_PERSIST_SESSION_ID:-}"
[ -z "$SESSION_ID" ] && exit 0

SESSIONS_DIR="${CLAUDE_PROJECT_DIR}/.claude/sessions"
SESSION_FILE="${SESSIONS_DIR}/${SESSION_ID}.json"

# Only stamp ended_at if this session was explicitly saved via /session-save
if [ -f "$SESSION_FILE" ] && command -v python3 &>/dev/null; then
    python3 - "${SESSION_FILE}" <<'EOF'
import json, sys, datetime
path = sys.argv[1]
try:
    with open(path) as f:
        d = json.load(f)
except Exception:
    d = {}
d["ended_at"] = datetime.datetime.utcnow().isoformat() + "Z"
with open(path, "w") as f:
    json.dump(d, f, indent=2)
EOF
fi

exit 0
