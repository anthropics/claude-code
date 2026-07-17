#!/bin/bash

# Blocks high-blast-radius shell commands while a Ralph loop is active.

set -euo pipefail

RALPH_STATE_FILE=".claude/ralph-loop.local.md"

if [[ ! -f "$RALPH_STATE_FILE" ]]; then
  exit 0
fi

HOOK_INPUT=$(cat)
COMMAND=$(echo "$HOOK_INPUT" | jq -r '.tool_input.command // ""' 2>/dev/null || true)

if [[ -z "$COMMAND" ]]; then
  exit 0
fi

BLOCK_PATTERNS=(
  '(^|[;&|[:space:]])git[[:space:]]+push([[:space:]]|$)'
  '(^|[;&|[:space:]])git[[:space:]]+push[[:space:]]+--force'
  '(^|[;&|[:space:]])gh[[:space:]]+pr[[:space:]]+merge([[:space:]]|$)'
  '(^|[;&|[:space:]])gh[[:space:]]+workflow[[:space:]]+run([[:space:]]|$)'
  '(^|[;&|[:space:]])npm[[:space:]]+publish([[:space:]]|$)'
  '(^|[;&|[:space:]])pnpm[[:space:]]+publish([[:space:]]|$)'
  '(^|[;&|[:space:]])yarn[[:space:]]+publish([[:space:]]|$)'
  '(^|[;&|[:space:]])bun[[:space:]]+publish([[:space:]]|$)'
  '(^|[;&|[:space:]])wrangler[[:space:]]+deploy([[:space:]]|$)'
  '(^|[;&|[:space:]])vercel([[:space:]]|$)'
)

for pattern in "${BLOCK_PATTERNS[@]}"; do
  if [[ "$COMMAND" =~ $pattern ]]; then
    cat >&2 <<'EOF'
Ralph loop guard blocked this command.

Ralph is an experimental local iteration loop and must not push, merge, publish,
or deploy changes. Stop the loop with /cancel-ralph, review the work manually,
run verification, then perform release or merge actions outside the loop.
EOF
    exit 2
  fi
done
