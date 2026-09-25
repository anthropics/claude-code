#!/usr/bin/env bash
set -euo pipefail

SESSIONS_DIR="${CLAUDE_PROJECT_DIR}/.claude/sessions"
mkdir -p "$SESSIONS_DIR"

RESUME_FILE="${CLAUDE_PROJECT_DIR}/.claude/.session-resume"

# Resume path: a previous /session-save wrote the session ID here
if [ -f "$RESUME_FILE" ]; then
    SESSION_ID=$(tr -d '[:space:]' < "$RESUME_FILE")
    rm -f "$RESUME_FILE"
    SESSION_FILE="${SESSIONS_DIR}/${SESSION_ID}.json"

    if [ -f "$SESSION_FILE" ] && command -v python3 &>/dev/null; then
        echo "CLAUDE_PERSIST_SESSION_ID=${SESSION_ID}" >> "${CLAUDE_ENV_FILE}"
        python3 - "${SESSION_FILE}" "${SESSION_ID}" <<'EOF'
import json, sys

path, sid = sys.argv[1], sys.argv[2]
try:
    with open(path) as f:
        d = json.load(f)
except Exception:
    d = {}

lines = [f"Resuming session {sid}."]
if d.get("saved_at"):
    lines.append(f"Saved: {d['saved_at']}")
if d.get("last_task"):
    lines.append(f"Last task: {d['last_task']}")
if d.get("summary"):
    lines.append(f"Context: {d['summary']}")

print(json.dumps({
    "hookSpecificOutput": {
        "hookEventName": "SessionStart",
        "additionalContext": "\n".join(lines)
    }
}))
EOF
        exit 0
    fi
fi

# New session: generate a fresh ID and track it for the lifetime of this session
SESSION_ID="sess_$(date -u +%Y%m%d_%H%M%S)_$$"
echo "CLAUDE_PERSIST_SESSION_ID=${SESSION_ID}" >> "${CLAUDE_ENV_FILE}"

python3 -c "
import json, sys
sid = sys.argv[1]
print(json.dumps({
    'hookSpecificOutput': {
        'hookEventName': 'SessionStart',
        'additionalContext': f'Session ID: {sid}'
    }
}))
" "${SESSION_ID}"

exit 0
