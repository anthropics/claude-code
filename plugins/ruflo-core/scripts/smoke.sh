#!/usr/bin/env bash
# Structural smoke test for ruflo-core v0.2.0 (ADR-0001).
set -u
ROOT="$(cd "$(dirname "$0")/.." && pwd)"
PASS=0
FAIL=0
step() { printf "→ %s ... " "$1"; }
ok()   { printf "PASS\n"; PASS=$((PASS+1)); }
bad()  { printf "FAIL: %s\n" "$1"; FAIL=$((FAIL+1)); }

step "1. plugin.json declares 0.2.0 with new keywords"
v=$(grep -E '"version"' "$ROOT/.claude-plugin/plugin.json" | grep -oE '[0-9]+\.[0-9]+\.[0-9]+' | head -1)
if [[ "$v" != "0.2.0" ]]; then
  bad "expected 0.2.0, got '$v'"
else
  miss=""
  for k in foundation mcp-server plugin-catalog discovery; do
    grep -q "\"$k\"" "$ROOT/.claude-plugin/plugin.json" || miss="$miss $k"
  done
  [[ -z "$miss" ]] && ok || bad "missing keywords:$miss"
fi

step "2. .mcp.json registers a 'ruflo' MCP server"
F="$ROOT/.mcp.json"
if [[ -f "$F" ]] && grep -q '"ruflo"' "$F" && grep -q '"command"' "$F"; then
  ok
else
  bad ".mcp.json missing or no ruflo server registration"
fi

step "3. all 3 agents present with valid frontmatter"
miss=""
for a in coder researcher reviewer; do
  f="$ROOT/agents/$a.md"
  [[ -f "$f" ]] || { miss="$miss missing-$a"; continue; }
  for k in 'name:' 'description:'; do
    grep -q "^$k" "$f" || miss="$miss $a-no-$k"
  done
done
[[ -z "$miss" ]] && ok || bad "$miss"

step "4. all 3 skills present with valid frontmatter"
miss=""
for s in init-project ruflo-doctor discover-plugins; do
  f="$ROOT/skills/$s/SKILL.md"
  [[ -f "$f" ]] || { miss="$miss missing-$s"; continue; }
  for k in 'name:' 'description:' 'allowed-tools:'; do
    grep -q "^$k" "$f" || miss="$miss $s-no-$k"
  done
done
[[ -z "$miss" ]] && ok || bad "$miss"

step "5. discover-plugins catalog references at least 25 sibling plugins"
F="$ROOT/skills/discover-plugins/SKILL.md"
n=$(grep -oE 'ruflo-[a-z-]+' "$F" | sort -u | wc -l | tr -d ' ')
if [[ $n -ge 25 ]]; then
  ok
else
  bad "expected ≥25 distinct ruflo-* references, got $n"
fi

step "6. README pins @claude-flow/cli to v3.6"
grep -qE "@claude-flow/cli.*v3\.6|v3\.6.*claude-flow/cli" "$ROOT/README.md" \
  && ok || bad "Compatibility pin to v3.6 missing"

step "7. README cross-references sibling contracts"
F="$ROOT/README.md"
miss=""
grep -q "Namespace convention" "$F" || miss="$miss namespace"
grep -qE "3-gate|3 gates|three gates" "$F" || miss="$miss 3-gate"
grep -qE "4-step|4 step" "$F" || miss="$miss 4-step"
[[ -z "$miss" ]] && ok || bad "missing cross-references:$miss"

step "8. ADR-0001 exists with status Proposed"
ADR="$ROOT/docs/adrs/0001-core-contract.md"
[[ -f "$ADR" ]] && grep -qE "^status:[[:space:]]*Proposed" "$ADR" \
  && ok || bad "ADR missing or status != Proposed"

step "9. /ruflo-status command invokes doctor + status"
F="$ROOT/commands/ruflo-status.md"
if grep -q "doctor" "$F" && grep -q "status" "$F"; then
  ok
else
  bad "ruflo-status command missing doctor/status invocation"
fi

step "10. no wildcard tool grants in skills"
bad_skills=""
for f in "$ROOT"/skills/*/SKILL.md; do
  grep -q '^allowed-tools:[[:space:]]*\*' "$f" && bad_skills="$bad_skills $(basename $(dirname "$f"))"
done
[[ -z "$bad_skills" ]] && ok || bad "wildcard:$bad_skills"

printf "\n%s passed, %s failed\n" "$PASS" "$FAIL"
[[ $FAIL -eq 0 ]] || exit 1
