#!/usr/bin/env bash
set -uo pipefail

PASS=0
FAIL=0

ROOT="$(cd "$(dirname "$0")/.." && pwd)"
COMMAND="$ROOT/commands/code-review.md"

check() {
  local description="$1"
  local result="$2"
  if [[ "$result" == "pass" ]]; then
    echo "  PASS  $description"
    PASS=$((PASS + 1))
  else
    echo "  FAIL  $description"
    FAIL=$((FAIL + 1))
  fi
}

echo "Linting code-review plugin..."
echo ""

check "command has allowed-tools in frontmatter" \
  "$(grep -q '^allowed-tools:' "$COMMAND" && echo pass || echo fail)"

check "command has description in frontmatter" \
  "$(grep -q '^description:' "$COMMAND" && echo pass || echo fail)"

while IFS= read -r ref; do
  check "referenced file exists: $ref" \
    "$([[ -f "$ROOT/$ref" ]] && echo pass || echo fail)"
done < <(grep -oE 'references/[a-zA-Z0-9_-]+\.md' "$COMMAND" || true)

echo ""
echo "Results: $PASS passed, $FAIL failed"
[[ $FAIL -eq 0 ]]
