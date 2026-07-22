#!/usr/bin/env bash
# UserPromptSubmit hook: one-line focus context on every prompt — the
# top-of-stack entry, or "follow plan" with the next item when the stack is
# empty. Silent outside twilight projects; never blocks.

set -u
HERE=$(cd "$(dirname "$0")" && pwd)
CLI="$HERE/twilight-focus.sh"

INPUT=$(cat 2>/dev/null) || exit 0
CWD=$(jq -r '.cwd // empty' <<<"$INPUT" 2>/dev/null)
[ -n "$CWD" ] && [ -d "$CWD" ] && cd "$CWD" 2>/dev/null

ROOT=$("$CLI" root)
[ -n "$ROOT" ] || exit 0

TOP=$("$CLI" show | head -1)
if [ "$TOP" != "empty" ]; then
  CTX="twilight focus: working $TOP (top of stack; file-over-memory)"
else
  CTX="twilight focus: stack empty"
  while IFS= read -r plan; do
    [ -n "$plan" ] || continue
    nextid=$("$CLI" next "$plan" | grep -oE '[0-9.]+' | head -1)
    [ -n "$nextid" ] && CTX="$CTX — follow plan $plan, next item $nextid"
  done < <("$CLI" plans)
fi

jq -cn --arg ctx "$CTX" \
  '{hookSpecificOutput: {hookEventName: "UserPromptSubmit", additionalContext: $ctx}}' 2>/dev/null
exit 0
