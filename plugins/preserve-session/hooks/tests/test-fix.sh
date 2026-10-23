#!/usr/bin/env bash
# test-fix.sh
#
# Minimal TDD test for fix.sh v1.3.1 — verifies the new copy-branch slug
# collision guard (H2). Additional fix.sh scenarios (rename, move, merge) are
# covered in v1.4.0 under M6.
#
# Assertions:
#   (1) fix.sh on a freshly-copied project whose new path collides with an
#       existing registry entry's slug → exits 1 with collision warning,
#       registry unchanged
#   (2) --force overrides the guard → registers the new hash

set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
FIX_SH="$(cd "$SCRIPT_DIR/.." && pwd)/fix.sh"

if [[ ! -f "$FIX_SH" ]]; then
  echo "TEST SETUP ERROR: $FIX_SH not found" >&2
  exit 2
fi

fail() { echo "FAIL: $*" >&2; exit 1; }

_pick_python() {
  for c in python3 python; do
    if command -v "$c" >/dev/null 2>&1; then echo "$c"; return 0; fi
  done
  echo "TEST SETUP ERROR: no python available" >&2; exit 2
}
PY=$(_pick_python)

FAKE_HOME_RAW=$(mktemp -d)
trap 'rm -rf "$FAKE_HOME_RAW"' EXIT
FAKE_HOME=$("$PY" -c "import os, sys; print(os.path.realpath(sys.argv[1]))" "$FAKE_HOME_RAW")

# Set up registry with an "original" entry whose slug will collide with NEW_DIR.
# Using /foo-bar vs /foo/bar: both slug to -foo-bar.
ORIG_DIR="$FAKE_HOME/collide-src"       # original alive project
NEW_DIR="$FAKE_HOME/collide/src"         # new copy, will collide slug with ORIG_DIR

mkdir -p "$ORIG_DIR/.claude" "$NEW_DIR/.claude"
mkdir -p "$FAKE_HOME/.claude/projects"

H_ORIG="aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa"
H_NEW="bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbbbbb"

echo "$H_ORIG" > "$ORIG_DIR/.claude/hash.txt"
echo "$H_NEW"  > "$NEW_DIR/.claude/hash.txt"

# Registry has only ORIG_DIR; NEW_DIR's hash is present on disk but not in
# registry (typical "just copied the project, haven't run /fix yet" state).
REGISTRY="$FAKE_HOME/.claude/project-registry.json"
"$PY" -c "
import json
open('$REGISTRY', 'w').write(json.dumps({'$H_ORIG': '$ORIG_DIR'}, indent=2))
"

# Sanity check: the two paths really do share a slug
_slug() {
  "$PY" -c "import re, sys, unicodedata; print(re.sub(r'[^a-zA-Z0-9-]', '-', unicodedata.normalize('NFC', sys.argv[1])))" "$1"
}
[[ "$(_slug "$ORIG_DIR")" == "$(_slug "$NEW_DIR")" ]] \
  || fail "TEST SETUP: paths do not share a slug"

# --- Assertion 1: fix.sh without --force in NEW_DIR → exits 1, warns, no registry change ---

set +e
OUTPUT=$(cd "$NEW_DIR" && HOME="$FAKE_HOME" bash "$FIX_SH" 2>&1)
EXIT_CODE=$?
set -e

[[ $EXIT_CODE -eq 1 ]] \
  || fail "expected exit 1 on collision without --force, got $EXIT_CODE. Output:
$OUTPUT"

echo "$OUTPUT" | grep -q "slug collision detected" \
  || fail "expected collision warning, got:
$OUTPUT"

REG_AFTER=$("$PY" -c "import json; print(len(json.load(open('$REGISTRY'))))")
[[ "$REG_AFTER" -eq 1 ]] \
  || fail "registry should still have exactly 1 entry, got $REG_AFTER"

# --- Assertion 2: fix.sh --force in NEW_DIR → registers NEW_DIR ---

OUTPUT=$(cd "$NEW_DIR" && HOME="$FAKE_HOME" bash "$FIX_SH" --force 2>&1)

echo "$OUTPUT" | grep -q "Proceeding with --force" \
  || fail "expected '--force' path to proceed, got:
$OUTPUT"

REG_ENTRIES=$("$PY" -c "import json; print(len(json.load(open('$REGISTRY'))))")
[[ "$REG_ENTRIES" -eq 2 ]] \
  || fail "registry should have 2 entries after --force, got $REG_ENTRIES"

# Verify the new entry in registry points to NEW_DIR
HAS_NEW=$("$PY" -c "
import json
d = json.load(open('$REGISTRY'))
print('yes' if '$NEW_DIR' in d.values() else 'no')
")
[[ "$HAS_NEW" == "yes" ]] \
  || fail "NEW_DIR not registered after --force"

echo "PASS"
