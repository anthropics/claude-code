#!/usr/bin/env bash
# SessionStart hook: inject the focus stack (with push dates), each active
# plan's next unchecked/blocked item, and lock status. Silent outside
# twilight projects; never blocks (exit 0 always).

set -u
HERE=$(cd "$(dirname "$0")" && pwd)
CLI="$HERE/twilight-focus.sh"

INPUT=$(cat 2>/dev/null) || exit 0
CWD=$(jq -r '.cwd // empty' <<<"$INPUT" 2>/dev/null)
SESSION_ID=$(jq -r '.session_id // empty' <<<"$INPUT" 2>/dev/null)
[ -n "$CWD" ] && [ -d "$CWD" ] && cd "$CWD" 2>/dev/null

# Locate the twilight project root the same way the CLI does.
ROOT="$PWD"
while [ "$ROOT" != "/" ] && [ ! -d "$ROOT/agents" ]; do ROOT=$(dirname "$ROOT"); done
[ -d "$ROOT/agents" ] || exit 0

STACK=$("$CLI" show)

# Lock: acquire if free; report the owner if another session holds it.
LOCK_LINE="lock: acquired by this session"
if [ -n "$SESSION_ID" ]; then
  CHECK=$("$CLI" lock check "$SESSION_ID")
  if [ "$CHECK" = "ok" ]; then
    "$CLI" lock acquire "$SESSION_ID" 2>/dev/null
  else
    LOCK_LINE="lock: $CHECK — adopt with /focus reset + re-push, work read-only, or use a worktree"
  fi
else
  LOCK_LINE="lock: no session id provided"
fi

# Active plans and their next items, from specs/INDEX.md.
PLANS=""
if [ -f "$ROOT/specs/INDEX.md" ]; then
  while IFS= read -r plan; do
    next=$(grep -m1 -E '^- [0-9.]+ \[[ ~]\]' "$ROOT/agents/$plan-plan.md" 2>/dev/null)
    PLANS="$PLANS
plan $plan — next: ${next:-all items complete}"
  done < <(sed -n 's/.*\[\([A-Za-z0-9_-]*\)-plan\].*|[[:space:]]*active[[:space:]]*|.*/\1/p' "$ROOT/specs/INDEX.md")
fi

CTX="twilight focus state (file-over-memory: this, not conversational recall, is what is being worked)
focus stack (top first):
$STACK
$PLANS
$LOCK_LINE"

jq -cn --arg ctx "$CTX" \
  '{hookSpecificOutput: {hookEventName: "SessionStart", additionalContext: $ctx}}' 2>/dev/null
exit 0
