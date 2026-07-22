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

ROOT="$PWD"
while [ "$ROOT" != "/" ] && [ ! -d "$ROOT/agents" ]; do ROOT=$(dirname "$ROOT"); done
[ -d "$ROOT/agents" ] || exit 0

TOP=$("$CLI" show | head -1)
if [ "$TOP" != "empty" ]; then
  CTX="twilight focus: working $TOP (top of stack; file-over-memory)"
else
  CTX="twilight focus: stack empty"
  if [ -f "$ROOT/specs/INDEX.md" ]; then
    while IFS= read -r plan; do
      nextid=$(grep -m1 -E '^- [0-9.]+ \[[ ~]\]' "$ROOT/agents/$plan-plan.md" 2>/dev/null | awk '{print $2}')
      [ -n "$nextid" ] && CTX="$CTX — follow plan $plan, next item $nextid"
    done < <(sed -n 's/.*\[\([A-Za-z0-9_-]*\)-plan\].*|[[:space:]]*active[[:space:]]*|.*/\1/p' "$ROOT/specs/INDEX.md")
  fi
fi

jq -cn --arg ctx "$CTX" \
  '{hookSpecificOutput: {hookEventName: "UserPromptSubmit", additionalContext: $ctx}}' 2>/dev/null
exit 0
