#!/usr/bin/env bash
# test-registry-write.sh
#
# Minimal TDD test for common.sh registry_write — verifies v1.3.1 additions:
# corrupt-registry backup (non-strict mode) and isinstance(dict) guard.
# Full session-start integration test is deferred to v1.4.0 under M6.
#
# Assertions:
#   (1) corrupt JSON in non-strict mode → original file moved to
#       .corrupt-backup.<ts>, new registry initialized with the new entry
#   (2) non-dict JSON (e.g. JSON array) in non-strict mode → same behavior
#   (3) strict mode + corrupt JSON → exit 1, no backup, file untouched

set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
COMMON_SH="$(cd "$SCRIPT_DIR/.." && pwd)/common.sh"

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

mkdir -p "$FAKE_HOME/.claude"
REGISTRY="$FAKE_HOME/.claude/project-registry.json"

_reset_registry_content() {
  # $1 = literal content to write to registry
  printf '%s' "$1" > "$REGISTRY"
  # remove any lingering backups
  rm -f "$FAKE_HOME/.claude/project-registry.json.corrupt-backup."*
  rm -f "$REGISTRY.lock"
}

_call_registry_write() {
  # Invoke registry_write via a minimal bash wrapper that sources common.sh
  # with REGISTRY pointing at the fake path.
  HOME="$FAKE_HOME" REGISTRY="$REGISTRY" bash -c "
    source '$COMMON_SH'
    registry_write '$1' '$2' '$3'
  "
}

# --- Assertion 1: corrupt JSON, non-strict ---

_reset_registry_content "not valid json {{{"

_call_registry_write "11111111-aaaa-aaaa-aaaa-111111111111" "/some/path" "" 2> "$FAKE_HOME/err1.log"

# backup must exist
shopt -s nullglob
BACKUPS=("$FAKE_HOME"/.claude/project-registry.json.corrupt-backup.*)
shopt -u nullglob
[[ ${#BACKUPS[@]} -eq 1 ]] \
  || fail "expected 1 corrupt-backup file, got ${#BACKUPS[@]}"

# registry file must be valid JSON now with exactly the new entry
ENTRY_COUNT=$("$PY" -c "import json; d=json.load(open('$REGISTRY')); print(len(d))")
[[ "$ENTRY_COUNT" -eq 1 ]] \
  || fail "expected 1 entry in new registry, got $ENTRY_COUNT"

grep -q "corrupt JSON" "$FAKE_HOME/err1.log" \
  || fail "expected 'corrupt JSON' message in stderr. Got:
$(cat "$FAKE_HOME/err1.log")"

# --- Assertion 2: valid JSON but non-dict (array) ---

_reset_registry_content '["not", "a", "dict"]'

_call_registry_write "22222222-bbbb-bbbb-bbbb-222222222222" "/another/path" "" 2> "$FAKE_HOME/err2.log"

shopt -s nullglob
BACKUPS=("$FAKE_HOME"/.claude/project-registry.json.corrupt-backup.*)
shopt -u nullglob
[[ ${#BACKUPS[@]} -eq 1 ]] \
  || fail "expected 1 backup after non-dict reset, got ${#BACKUPS[@]}"

ENTRY_COUNT=$("$PY" -c "import json; d=json.load(open('$REGISTRY')); print(len(d))")
[[ "$ENTRY_COUNT" -eq 1 ]] \
  || fail "expected 1 entry after non-dict reset, got $ENTRY_COUNT"

grep -q "not a JSON object" "$FAKE_HOME/err2.log" \
  || fail "expected 'not a JSON object' message. Got:
$(cat "$FAKE_HOME/err2.log")"

# --- Assertion 3: strict + corrupt → exit 1, no backup ---

_reset_registry_content "still not json"
REGISTRY_MTIME_BEFORE=$(stat -f %m "$REGISTRY" 2>/dev/null || stat -c %Y "$REGISTRY")

set +e
_call_registry_write "33333333-cccc-cccc-cccc-333333333333" "/x" "strict" 2> "$FAKE_HOME/err3.log"
EXIT=$?
set -e

[[ $EXIT -eq 1 ]] \
  || fail "expected strict mode to exit 1 on corrupt JSON, got $EXIT"

shopt -s nullglob
BACKUPS=("$FAKE_HOME"/.claude/project-registry.json.corrupt-backup.*)
shopt -u nullglob
[[ ${#BACKUPS[@]} -eq 0 ]] \
  || fail "strict mode must NOT create a backup, got ${#BACKUPS[@]}"

REGISTRY_MTIME_AFTER=$(stat -f %m "$REGISTRY" 2>/dev/null || stat -c %Y "$REGISTRY")
[[ "$REGISTRY_MTIME_BEFORE" == "$REGISTRY_MTIME_AFTER" ]] \
  || fail "strict mode must not modify registry (mtime changed)"

echo "PASS"
