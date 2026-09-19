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

ROOT=$("$CLI" root)
[ -n "$ROOT" ] || exit 0

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

PLANS=""
while IFS= read -r plan; do
  [ -n "$plan" ] || continue
  next=$("$CLI" next "$plan")
  PLANS="$PLANS
plan $plan — next: ${next:-all items complete}"
done < <("$CLI" plans)

CTX="twilight focus state (file-over-memory: this, not conversational recall, is what is being worked)
focus stack (top first):
$STACK
$PLANS
$LOCK_LINE"

jq -cn --arg ctx "$CTX" \
  '{hookSpecificOutput: {hookEventName: "SessionStart", additionalContext: $ctx}}' 2>/dev/null
exit 0
