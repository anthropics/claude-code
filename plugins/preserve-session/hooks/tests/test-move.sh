#!/usr/bin/env bash
# test-move.sh
#
# TDD test for v1.2.0 `/preserve-session:move` — verifies move.sh migrates the
# source session files into the target slug folder.
# Semantics (옵션 X, simple):
#   - `os.rename` style: filename and sessionId are PRESERVED (source is gone,
#     no dedupe conflict with target)
#   - `cwd` field is REWRITTEN to target realpath (for Ctrl+A picker filter)
#
# Assertions:
#   (1) Source slug dir is empty OR missing (files were moved out)
#   (2) Target slug dir has exactly 1 .jsonl
#   (3) Target filename EQUALS source original filename (sessionId preserved)
#   (4) Every `sessionId` in target EQUALS the original
#   (5) Every `cwd` in target EQUALS target realpath (rewrite applied)

set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
MOVE_SH="$(cd "$SCRIPT_DIR/.." && pwd)/move.sh"

if [[ ! -f "$MOVE_SH" ]]; then
  echo "TEST SETUP ERROR: $MOVE_SH not found" >&2
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

SOURCE_DIR="$FAKE_HOME/source-project"
TARGET_DIR="$FAKE_HOME/target-project"
mkdir -p "$SOURCE_DIR/.claude" "$TARGET_DIR/.claude" "$FAKE_HOME/.claude/projects"

SOURCE_HASH="11111111-1111-1111-1111-111111111111"
TARGET_HASH="22222222-2222-2222-2222-222222222222"
echo "$SOURCE_HASH" > "$SOURCE_DIR/.claude/hash.txt"
echo "$TARGET_HASH" > "$TARGET_DIR/.claude/hash.txt"

REGISTRY="$FAKE_HOME/.claude/project-registry.json"
"$PY" -c "
import json
d = {'$SOURCE_HASH': '$SOURCE_DIR', '$TARGET_HASH': '$TARGET_DIR'}
open('$REGISTRY', 'w').write(json.dumps(d, indent=2))
"

SOURCE_SLUG=$(_slug "$SOURCE_DIR")
TARGET_SLUG=$(_slug "$TARGET_DIR")
SOURCE_PROJECTS_DIR="$FAKE_HOME/.claude/projects/$SOURCE_SLUG"
TARGET_PROJECTS_DIR="$FAKE_HOME/.claude/projects/$TARGET_SLUG"
mkdir -p "$SOURCE_PROJECTS_DIR"

ORIG_SESSION_ID="aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa"
ORIG_FILENAME="${ORIG_SESSION_ID}.jsonl"
SOURCE_JSONL="$SOURCE_PROJECTS_DIR/$ORIG_FILENAME"

cat > "$SOURCE_JSONL" <<JSONL
{"type":"file-history-snapshot","messageId":"m0","snapshot":{},"isSnapshotUpdate":false}
{"parentUuid":null,"isSidechain":false,"type":"user","message":{"role":"user","content":"hello"},"uuid":"msg-uuid-1","sessionId":"$ORIG_SESSION_ID","cwd":"$SOURCE_DIR","timestamp":"2026-01-01T00:00:00Z"}
{"parentUuid":"msg-uuid-1","isSidechain":false,"type":"assistant","message":{"role":"assistant","content":"hi"},"uuid":"msg-uuid-2","sessionId":"$ORIG_SESSION_ID","cwd":"$SOURCE_DIR","timestamp":"2026-01-01T00:00:01Z"}
{"type":"last-prompt","lastPrompt":"hello","sessionId":"$ORIG_SESSION_ID"}
JSONL

# --- run move from target project with fake HOME ---

set +e
MOVE_OUTPUT=$(cd "$TARGET_DIR" && HOME="$FAKE_HOME" bash "$MOVE_SH" "$SOURCE_DIR" 2>&1)
MOVE_EXIT=$?
set -e

# --- assertions ---

# (1) Source dir empty or removed
shopt -s nullglob
if [[ -d "$SOURCE_PROJECTS_DIR" ]]; then
  SRC_REMAINING=("$SOURCE_PROJECTS_DIR"/*.jsonl)
  [[ ${#SRC_REMAINING[@]} -eq 0 ]] \
    || fail "source dir still has ${#SRC_REMAINING[@]} .jsonl after move. move output:
$MOVE_OUTPUT"
fi
shopt -u nullglob

# (2) Target has exactly 1 .jsonl
if [[ ! -d "$TARGET_PROJECTS_DIR" ]]; then
  fail "target projects dir missing (move exit=$MOVE_EXIT). move output:
$MOVE_OUTPUT"
fi
shopt -s nullglob
TARGET_FILES=("$TARGET_PROJECTS_DIR"/*.jsonl)
shopt -u nullglob
[[ ${#TARGET_FILES[@]} -eq 1 ]] \
  || fail "expected 1 .jsonl in target, got ${#TARGET_FILES[@]}. move output:
$MOVE_OUTPUT"

TARGET_JSONL="${TARGET_FILES[0]}"
TARGET_BASENAME=$(basename "$TARGET_JSONL")

# (3) Filename preserved
[[ "$TARGET_BASENAME" == "$ORIG_FILENAME" ]] \
  || fail "move changed filename: expected $ORIG_FILENAME, got $TARGET_BASENAME"

# (4) sessionId preserved
BAD=$("$PY" - "$TARGET_JSONL" "$ORIG_SESSION_ID" <<'PYEOF'
import json, sys
path, orig = sys.argv[1], sys.argv[2]
with open(path) as f:
    for ln, line in enumerate(f, 1):
        line = line.strip()
        if not line: continue
        try: obj = json.loads(line)
        except Exception as e:
            print(f'PARSE_ERROR line {ln}: {e}'); continue
        if 'sessionId' in obj and obj['sessionId'] != orig:
            print(f'line {ln}: sessionId={obj["sessionId"]!r} (expected {orig})')
PYEOF
)
[[ -z "$BAD" ]] || fail "move altered sessionId: $BAD"

# (5) cwd rewritten to target realpath
TARGET_REAL=$("$PY" -c "import os, sys; print(os.path.realpath(sys.argv[1]))" "$TARGET_DIR")
BAD=$("$PY" - "$TARGET_JSONL" "$TARGET_REAL" <<'PYEOF'
import json, sys
path, want = sys.argv[1], sys.argv[2]
with open(path) as f:
    for ln, line in enumerate(f, 1):
        line = line.strip()
        if not line: continue
        try: obj = json.loads(line)
        except Exception: continue
        if 'cwd' in obj and obj['cwd'] != want:
            print(f'line {ln}: cwd={obj["cwd"]!r} expected={want!r}')
PYEOF
)
[[ -z "$BAD" ]] || fail "move did not rewrite cwd: $BAD"

echo "PASS"
