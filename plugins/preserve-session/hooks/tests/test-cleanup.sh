#!/usr/bin/env bash
# test-cleanup.sh
#
# TDD test for v1.3.0 `/preserve-session:cleanup` — verifies registry and
# (optionally) slug-folder cleanup with safety guards.
#
# Assertions (all must pass for GREEN):
#   (1) list mode output includes session count per entry ("N sessions" or
#       "0 sessions — auto-cleaned" for 0-count)
#   (2) `--remove <stale-path>`: registry entry removed, slug folder PRESERVED
#   (3) `--remove-with-sessions <stale-path>`: registry removed AND slug folder
#       rmtree'd
#   (4) Safety: `--remove-with-sessions` against a NON-stale path (dir exists)
#       removes the registry entry but PRESERVES the slug folder (with warning)
#   (5) Safety: a symlink at `~/.claude/projects/<slug>` is NEVER removed,
#       even with `--remove-with-sessions`

set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
CLEANUP_SH="$(cd "$SCRIPT_DIR/.." && pwd)/cleanup.sh"

if [[ ! -f "$CLEANUP_SH" ]]; then
  echo "TEST SETUP ERROR: $CLEANUP_SH not found" >&2
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

_slug() {
  "$PY" -c "import re, sys, unicodedata; print(re.sub(r'[^a-zA-Z0-9-]', '-', unicodedata.normalize('NFC', sys.argv[1])))" "$1"
}

# --- hermetic setup ---

FAKE_HOME_RAW=$(mktemp -d)
trap 'rm -rf "$FAKE_HOME_RAW"' EXIT
FAKE_HOME=$("$PY" -c "import os, sys; print(os.path.realpath(sys.argv[1]))" "$FAKE_HOME_RAW")

ALIVE_DIR="$FAKE_HOME/alive-project"        # dir exists → not stale
STALE_DIR="$FAKE_HOME/stale-project"         # will delete → stale w/ sessions
CLEANED_DIR="$FAKE_HOME/cleaned-project"     # will delete → stale w/ 0 sessions
SYMLINK_DIR="$FAKE_HOME/symlink-project"     # slug folder is a symlink

mkdir -p "$ALIVE_DIR/.claude" "$STALE_DIR/.claude" "$CLEANED_DIR/.claude" "$SYMLINK_DIR/.claude"
mkdir -p "$FAKE_HOME/.claude/projects"

H_ALIVE="11111111-1111-1111-1111-111111111111"
H_STALE="22222222-2222-2222-2222-222222222222"
H_CLEANED="33333333-3333-3333-3333-333333333333"
H_SYMLINK="44444444-4444-4444-4444-444444444444"
echo "$H_ALIVE"   > "$ALIVE_DIR/.claude/hash.txt"
echo "$H_STALE"   > "$STALE_DIR/.claude/hash.txt"
echo "$H_CLEANED" > "$CLEANED_DIR/.claude/hash.txt"
echo "$H_SYMLINK" > "$SYMLINK_DIR/.claude/hash.txt"

REGISTRY="$FAKE_HOME/.claude/project-registry.json"
"$PY" -c "
import json
d = {
  '$H_ALIVE':   '$ALIVE_DIR',
  '$H_STALE':   '$STALE_DIR',
  '$H_CLEANED': '$CLEANED_DIR',
  '$H_SYMLINK': '$SYMLINK_DIR',
}
open('$REGISTRY', 'w').write(json.dumps(d, indent=2))
"

# slug folders
ALIVE_SLUG=$(_slug "$ALIVE_DIR")
STALE_SLUG=$(_slug "$STALE_DIR")
CLEANED_SLUG=$(_slug "$CLEANED_DIR")
SYMLINK_SLUG=$(_slug "$SYMLINK_DIR")

ALIVE_PROJ="$FAKE_HOME/.claude/projects/$ALIVE_SLUG"
STALE_PROJ="$FAKE_HOME/.claude/projects/$STALE_SLUG"
CLEANED_PROJ="$FAKE_HOME/.claude/projects/$CLEANED_SLUG"
SYMLINK_PROJ="$FAKE_HOME/.claude/projects/$SYMLINK_SLUG"

mkdir -p "$ALIVE_PROJ" "$STALE_PROJ"          # CLEANED_PROJ: left empty
mkdir -p "$CLEANED_PROJ"                      # create empty dir (auto-cleaned state)
# fake .jsonl fixtures
echo '{"type":"user","sessionId":"sid1"}' > "$ALIVE_PROJ/sid1.jsonl"
echo '{"type":"user","sessionId":"sid1b"}' > "$ALIVE_PROJ/sid1b.jsonl"
echo '{"type":"user","sessionId":"sid2"}' > "$STALE_PROJ/sid2.jsonl"
echo '{"type":"user","sessionId":"sid2b"}' > "$STALE_PROJ/sid2b.jsonl"
echo '{"type":"user","sessionId":"sid2c"}' > "$STALE_PROJ/sid2c.jsonl"

# symlink slug folder → some arbitrary target outside projects/
SYMLINK_TARGET="$FAKE_HOME/symlink-target"
mkdir -p "$SYMLINK_TARGET"
echo '{"type":"user","sessionId":"sid-sym"}' > "$SYMLINK_TARGET/sid-sym.jsonl"
ln -s "$SYMLINK_TARGET" "$SYMLINK_PROJ"

# make STALE_DIR and CLEANED_DIR actually stale (delete the dirs)
rm -rf "$STALE_DIR" "$CLEANED_DIR"
# keep SYMLINK_DIR too — it's alive but has a symlink slug (safety test)

# --- Assertion 1: list mode shows session counts ---

LIST_OUTPUT=$(HOME="$FAKE_HOME" bash "$CLEANUP_SH" 2>&1)
echo "$LIST_OUTPUT" | grep -q "2 sessions" \
  || fail "list mode missing session count '2 sessions' for ALIVE. Output:
$LIST_OUTPUT"
echo "$LIST_OUTPUT" | grep -q "3 sessions still in slug" \
  || fail "list mode missing '3 sessions still in slug' for STALE. Output:
$LIST_OUTPUT"
echo "$LIST_OUTPUT" | grep -qE "0 sessions.*auto-cleaned" \
  || fail "list mode missing '0 sessions — auto-cleaned' for CLEANED. Output:
$LIST_OUTPUT"

# --- Assertion 2: --remove preserves slug folder ---

HOME="$FAKE_HOME" bash "$CLEANUP_SH" --remove "$STALE_DIR" >/dev/null 2>&1

# registry should no longer have STALE
GONE=$("$PY" -c "
import json
d = json.load(open('$REGISTRY'))
print('yes' if '$STALE_DIR' not in d.values() else 'no')
")
[[ "$GONE" == "yes" ]] || fail "--remove did not remove registry entry"
[[ -d "$STALE_PROJ" ]] \
  || fail "--remove should PRESERVE slug folder, but $STALE_PROJ was removed"
STALE_FILES_BEFORE=3
STALE_FILES_AFTER=$(ls "$STALE_PROJ"/*.jsonl 2>/dev/null | wc -l | tr -d ' ')
[[ "$STALE_FILES_AFTER" -eq "$STALE_FILES_BEFORE" ]] \
  || fail "--remove should not touch slug files. Got $STALE_FILES_AFTER files"

# Restore STALE registry entry for Assertion 3 (refresh state)
"$PY" -c "
import json
d = json.load(open('$REGISTRY'))
d['$H_STALE'] = '$STALE_DIR'
open('$REGISTRY', 'w').write(json.dumps(d, indent=2))
"

# --- Assertion 3: --remove-with-sessions removes slug folder ---

HOME="$FAKE_HOME" bash "$CLEANUP_SH" --remove-with-sessions "$STALE_DIR" >/dev/null 2>&1

GONE=$("$PY" -c "
import json
d = json.load(open('$REGISTRY'))
print('yes' if '$STALE_DIR' not in d.values() else 'no')
")
[[ "$GONE" == "yes" ]] || fail "--remove-with-sessions did not remove registry"
[[ ! -d "$STALE_PROJ" ]] \
  || fail "--remove-with-sessions should remove slug folder, but $STALE_PROJ remains"

# --- Assertion 4: --remove-with-sessions on NON-stale path preserves slug ---

ALIVE_FILES_BEFORE=$(ls "$ALIVE_PROJ"/*.jsonl 2>/dev/null | wc -l | tr -d ' ')
HOME="$FAKE_HOME" bash "$CLEANUP_SH" --remove-with-sessions "$ALIVE_DIR" >/dev/null 2>&1

GONE=$("$PY" -c "
import json
d = json.load(open('$REGISTRY'))
print('yes' if '$ALIVE_DIR' not in d.values() else 'no')
")
[[ "$GONE" == "yes" ]] || fail "--remove-with-sessions (alive) did not remove registry"

[[ -d "$ALIVE_PROJ" ]] \
  || fail "--remove-with-sessions against ALIVE path should PRESERVE slug, but $ALIVE_PROJ removed"
ALIVE_FILES_AFTER=$(ls "$ALIVE_PROJ"/*.jsonl 2>/dev/null | wc -l | tr -d ' ')
[[ "$ALIVE_FILES_AFTER" -eq "$ALIVE_FILES_BEFORE" ]] \
  || fail "--remove-with-sessions (alive) touched slug files. Before=$ALIVE_FILES_BEFORE After=$ALIVE_FILES_AFTER"

# --- Assertion 5: symlink slug folder is skipped ---

# SYMLINK_DIR still exists (alive), so its symlink slug should be preserved anyway.
# Make it stale-but-symlink to test the symlink guard specifically.
rm -rf "$SYMLINK_DIR"
# Now SYMLINK is stale, with a symlink slug folder. Attempt --remove-with-sessions.
HOME="$FAKE_HOME" bash "$CLEANUP_SH" --remove-with-sessions "$SYMLINK_DIR" >/dev/null 2>&1

[[ -L "$SYMLINK_PROJ" ]] \
  || fail "symlink slug was removed or converted — safety guard failed"
[[ -f "$SYMLINK_TARGET/sid-sym.jsonl" ]] \
  || fail "symlink target file was removed — dangerous follow-symlink"

echo "PASS"
