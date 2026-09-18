#!/bin/bash
# Regression tests for validate-agent.sh (anthropics/claude-code#83803):
# - warnings must not abort the run: under `set -e`, `((x++))` returns nonzero
#   when x was 0, so the first warning killed the script with exit 1
# - multi-line descriptions (prose plus <example> blocks) must not be
#   false-flagged as missing examples
set -uo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
VALIDATOR="$SCRIPT_DIR/validate-agent.sh"
PLUGIN_ROOT="$(cd "$SCRIPT_DIR/../../.." && pwd)"
TMP_DIR="$(mktemp -d)" || exit 1
trap 'rm -rf "$TMP_DIR"' EXIT

failures=0

check() {
  local label="$1" expected="$2" file="$3"
  local actual=0
  bash "$VALIDATOR" "$file" > "$TMP_DIR/out.txt" 2>&1 || actual=$?
  if [ "$actual" -eq "$expected" ]; then
    echo "PASS: $label (exit $actual)"
  else
    echo "FAIL: $label (expected exit $expected, got $actual)"
    cat "$TMP_DIR/out.txt"
    failures=$((failures + 1))
  fi
}

# The plugin's own agents are valid and must pass.
for agent in "$PLUGIN_ROOT"/agents/*.md; do
  check "own agent $(basename "$agent")" 0 "$agent"
done

# A valid agent whose fields only trigger warnings must still exit 0,
# and must reach the summary line instead of aborting at the first warning.
cat > "$TMP_DIR/warning-agent.md" <<'EOF'
---
name: warning-agent
description: A valid description that has no example blocks and no trigger phrase
model: sonnet
color: blue
---

You are a test agent. Your job is to exist so the validator has something to warn about.
EOF
check "valid agent with warnings" 0 "$TMP_DIR/warning-agent.md"
if ! grep -q "Validation passed" "$TMP_DIR/out.txt"; then
  echo "FAIL: summary line missing (script aborted before finishing)"
  failures=$((failures + 1))
fi

# An invalid agent (bad name, missing color) must still fail with exit 1.
cat > "$TMP_DIR/invalid-agent.md" <<'EOF'
---
name: x
description: A valid description for an otherwise invalid agent file
model: sonnet
---

You are a test agent with an invalid name and no color field.
EOF
check "invalid agent" 1 "$TMP_DIR/invalid-agent.md"

echo ""
if [ "$failures" -gt 0 ]; then
  echo "$failures test(s) failed"
  exit 1
fi
echo "All tests passed"
