#!/bin/bash

set -euo pipefail

PLUGIN_ROOT=$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)
TMP_DIR=$(mktemp -d)
trap 'rm -rf "$TMP_DIR"' EXIT

cd "$TMP_DIR"

"$PLUGIN_ROOT/scripts/setup-ralph-loop.sh" Do work >/dev/null
grep -q '^max_iterations: 5$' .claude/ralph-loop.local.md

if "$PLUGIN_ROOT/scripts/setup-ralph-loop.sh" --max-iterations 0 Do work >/tmp/ralph-zero.out 2>/tmp/ralph-zero.err; then
  echo "Expected --max-iterations 0 to fail" >&2
  exit 1
fi

rm -rf .claude
mkdir -p .claude
cat > .claude/ralph-loop.local.md <<'STATE'
---
active: true
iteration: 1
max_iterations: 3
completion_promise: "DONE"
started_at: "2026-01-01T00:00:00Z"
---
Do work
STATE

cat > transcript-no-tag.jsonl <<'JSONL'
{"message":{"role":"assistant","content":[{"type":"text","text":"DONE"}]}}
JSONL

printf '{"transcript_path":"%s/transcript-no-tag.jsonl"}' "$TMP_DIR" \
  | CLAUDE_PLUGIN_ROOT="$PLUGIN_ROOT" "$PLUGIN_ROOT/hooks/stop-hook.sh" >/tmp/ralph-no-tag.out
grep -q '"decision": "block"' /tmp/ralph-no-tag.out
grep -q '^iteration: 2$' .claude/ralph-loop.local.md

cat > transcript-done.jsonl <<'JSONL'
{"message":{"role":"assistant","content":[{"type":"text","text":"<promise>DONE</promise>"}]}}
JSONL

printf '{"transcript_path":"%s/transcript-done.jsonl"}' "$TMP_DIR" \
  | CLAUDE_PLUGIN_ROOT="$PLUGIN_ROOT" "$PLUGIN_ROOT/hooks/stop-hook.sh" >/tmp/ralph-done.out
test ! -f .claude/ralph-loop.local.md

cat > .claude/ralph-loop.local.md <<'STATE'
---
active: true
iteration: 1
max_iterations: 3
completion_promise: null
started_at: "2026-01-01T00:00:00Z"
---
Do work
STATE

if printf '{"tool_name":"Bash","tool_input":{"command":"git push origin HEAD"}}' \
  | CLAUDE_PLUGIN_ROOT="$PLUGIN_ROOT" "$PLUGIN_ROOT/hooks/pretooluse-guard.sh" >/tmp/ralph-guard.out 2>/tmp/ralph-guard.err; then
  echo "Expected guard to block git push" >&2
  exit 1
fi
grep -q 'Ralph loop guard blocked this command' /tmp/ralph-guard.err

echo "ralph-wiggum smoke tests passed"
