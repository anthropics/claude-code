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

# --- Assertion 6: shared-slug guard — stale entry sharing a slug with an
#     alive entry MUST NOT trigger slug folder deletion, even with
#     --remove-with-sessions. This mirrors the real-world Korean-path collision
#     case where two distinct non-ASCII directories map to the same slug.
#     Here we use the ASCII form `/foo-bar` vs `/foo/bar` which both slug to
#     `-foo-bar` since `/` and `-` collapse to `-`.

COLLIDE_ALIVE="$FAKE_HOME/colfoo-bar"       # alive
COLLIDE_STALE="$FAKE_HOME/colfoo/bar"        # will be stale

mkdir -p "$COLLIDE_ALIVE/.claude" "$COLLIDE_STALE/.claude"
H_COL_ALIVE="55555555-5555-5555-5555-555555555555"
H_COL_STALE="66666666-6666-6666-6666-666666666666"
echo "$H_COL_ALIVE" > "$COLLIDE_ALIVE/.claude/hash.txt"
echo "$H_COL_STALE" > "$COLLIDE_STALE/.claude/hash.txt"

# Verify they share a slug (sanity check — if this fails the test premise is gone)
COL_ALIVE_SLUG=$(_slug "$COLLIDE_ALIVE")
COL_STALE_SLUG=$(_slug "$COLLIDE_STALE")
[[ "$COL_ALIVE_SLUG" == "$COL_STALE_SLUG" ]] \
  || fail "TEST SETUP: paths do not share a slug. alive=$COL_ALIVE_SLUG stale=$COL_STALE_SLUG"

COL_PROJ="$FAKE_HOME/.claude/projects/$COL_ALIVE_SLUG"
mkdir -p "$COL_PROJ"
echo '{"type":"user","sessionId":"sid-alive"}'  > "$COL_PROJ/sid-alive.jsonl"
echo '{"type":"user","sessionId":"sid-stale"}'  > "$COL_PROJ/sid-stale.jsonl"

# Add both to registry
"$PY" -c "
import json
d = json.load(open('$REGISTRY'))
d['$H_COL_ALIVE'] = '$COLLIDE_ALIVE'
d['$H_COL_STALE'] = '$COLLIDE_STALE'
open('$REGISTRY', 'w').write(json.dumps(d, indent=2))
"

# Make stale entry stale on disk
rm -rf "$COLLIDE_STALE"

# Attempt destructive cleanup on the stale entry
HOME="$FAKE_HOME" bash "$CLEANUP_SH" --remove-with-sessions "$COLLIDE_STALE" >/dev/null 2>&1

# Slug folder MUST still exist (alive sibling needs it)
[[ -d "$COL_PROJ" ]] \
  || fail "shared-slug guard failed: slug folder removed while alive sibling shared it"
# Alive sibling's .jsonl MUST still be present
[[ -f "$COL_PROJ/sid-alive.jsonl" ]] \
  || fail "alive sibling's session file was destroyed by cleanup of stale collision entry"

# --- Assertion 7: multi-invocation flow — (b)-before-(a) ordering is
#     load-bearing. cleanup.md mandates running --remove-with-sessions before
#     --remove because the (b) guard inspects the registry to detect alive
#     siblings. If --remove runs first for an alive sibling, it leaves the
#     registry in a state where the (b) guard can no longer see the alive
#     sibling and would delete the shared slug folder.
#
#     This test simulates the cleanup.md-prescribed flow: (b) first, then (a).
#     Both the alive sibling and the stale collision entry get cleaned up,
#     and the shared slug folder MUST survive (because (b) ran first while
#     the alive sibling was still registered).

# Re-seed state matching assertion 6: alive + stale sharing a slug, both in
# registry, slug folder contains both .jsonl files.
mkdir -p "$COLLIDE_STALE/.claude"           # re-create stale dir briefly
echo "$H_COL_STALE" > "$COLLIDE_STALE/.claude/hash.txt"
"$PY" -c "
import json
d = json.load(open('$REGISTRY'))
d['$H_COL_ALIVE'] = '$COLLIDE_ALIVE'
d['$H_COL_STALE'] = '$COLLIDE_STALE'
open('$REGISTRY', 'w').write(json.dumps(d, indent=2))
"
mkdir -p "$COL_PROJ"
echo '{"type":"user","sessionId":"alive2"}' > "$COL_PROJ/alive2.jsonl"
echo '{"type":"user","sessionId":"stale2"}' > "$COL_PROJ/stale2.jsonl"
rm -rf "$COLLIDE_STALE"  # make stale again

# Run in the order cleanup.md mandates: (b) first, then (a)
HOME="$FAKE_HOME" bash "$CLEANUP_SH" --remove-with-sessions "$COLLIDE_STALE" >/dev/null 2>&1
HOME="$FAKE_HOME" bash "$CLEANUP_SH" --remove                "$COLLIDE_ALIVE" >/dev/null 2>&1

# After the full flow, slug folder MUST still exist (alive sibling needed it
# when (b) ran, and (a) never touches disk)
[[ -d "$COL_PROJ" ]] \
  || fail "(b)-then-(a) flow: slug folder was destroyed despite correct ordering"
[[ -f "$COL_PROJ/alive2.jsonl" ]] \
  || fail "(b)-then-(a) flow: alive sibling's session file was destroyed"

# Both entries should be out of the registry
POST_LEN=$("$PY" -c "
import json
d = json.load(open('$REGISTRY'))
count = sum(1 for p in d.values() if p in ('$COLLIDE_ALIVE', '$COLLIDE_STALE'))
print(count)
")
[[ "$POST_LEN" -eq 0 ]] \
  || fail "(b)-then-(a) flow: both entries should be removed from registry, found $POST_LEN"

echo "PASS"
