#!/usr/bin/env bash
# test-copy.sh
#
# TDD test for v1.2.0 `/preserve-session:copy` — verifies copy.sh creates
# TRULY INDEPENDENT session copies in the target slug folder.
# Before copy.sh exists: RED (file missing → exit 2 with setup error).
# After A+ implementation lands: PASS.
#
# Assertions:
#   (1) Source .jsonl is byte-identical before and after copy (no mutation)
#   (2) Target slug directory contains exactly 1 .jsonl file
#   (3) Target filename differs from the source filename (new sessionId)
#   (4) Every `sessionId` field in the target differs from the original
#   (5) Every `cwd` field in the target equals the target project's realpath

set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
COPY_SH="$(cd "$SCRIPT_DIR/.." && pwd)/copy.sh"

if [[ ! -f "$COPY_SH" ]]; then
  echo "TEST SETUP ERROR: $COPY_SH not found" >&2
  exit 2
fi

# --- helpers ---

fail() {
  echo "FAIL: $*" >&2
  exit 1
}

_pick_python() {
  for c in python3 python; do
    if command -v "$c" >/dev/null 2>&1; then
      echo "$c"
      return 0
    fi
  done
  echo "TEST SETUP ERROR: no python available" >&2
  exit 2
}
PY=$(_pick_python)

_hash_file() {
  if command -v shasum >/dev/null 2>&1; then
    shasum -a 256 "$1" | awk '{print $1}'
  else
    sha256sum "$1" | awk '{print $1}'
  fi
}

_slug() {
  "$PY" -c "import re, sys, unicodedata; print(re.sub(r'[^a-zA-Z0-9-]', '-', unicodedata.normalize('NFC', sys.argv[1])))" "$1"
}

# --- setup hermetic environment ---

FAKE_HOME_RAW=$(mktemp -d)
trap 'rm -rf "$FAKE_HOME_RAW"' EXIT
# macOS: /var/folders -> /private/var/folders. Resolve once so paths match what
# copy.sh sees after its own realpath() call.
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
d = {
  '$SOURCE_HASH': '$SOURCE_DIR',
  '$TARGET_HASH': '$TARGET_DIR',
}
open('$REGISTRY', 'w').write(json.dumps(d, indent=2))
"

SOURCE_SLUG=$(_slug "$SOURCE_DIR")
SOURCE_PROJECTS_DIR="$FAKE_HOME/.claude/projects/$SOURCE_SLUG"
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

SOURCE_SHA_BEFORE=$(_hash_file "$SOURCE_JSONL")

# --- run copy from target project with fake HOME ---

set +e
COPY_OUTPUT=$(cd "$TARGET_DIR" && HOME="$FAKE_HOME" bash "$COPY_SH" "$SOURCE_DIR" 2>&1)
COPY_EXIT=$?
set -e

# --- assertions ---

# (1) Source file untouched
SOURCE_SHA_AFTER=$(_hash_file "$SOURCE_JSONL")
[[ "$SOURCE_SHA_BEFORE" == "$SOURCE_SHA_AFTER" ]] \
  || fail "source .jsonl was mutated (sha mismatch): before=$SOURCE_SHA_BEFORE after=$SOURCE_SHA_AFTER"

# (2) Target has exactly 1 .jsonl
TARGET_SLUG=$(_slug "$TARGET_DIR")
TARGET_PROJECTS_DIR="$FAKE_HOME/.claude/projects/$TARGET_SLUG"

if [[ ! -d "$TARGET_PROJECTS_DIR" ]]; then
  fail "target projects dir missing: $TARGET_PROJECTS_DIR (copy exit=$COPY_EXIT). copy stdout+stderr:
$COPY_OUTPUT"
fi

shopt -s nullglob
TARGET_FILES=("$TARGET_PROJECTS_DIR"/*.jsonl)
shopt -u nullglob
[[ ${#TARGET_FILES[@]} -eq 1 ]] \
  || fail "expected 1 .jsonl in target, got ${#TARGET_FILES[@]}. copy output:
$COPY_OUTPUT"

TARGET_JSONL="${TARGET_FILES[0]}"
TARGET_BASENAME=$(basename "$TARGET_JSONL")

# (3) Target filename differs from source filename
[[ "$TARGET_BASENAME" != "$ORIG_FILENAME" ]] \
  || fail "target filename equals source filename ($ORIG_FILENAME) — sessionId rewrite missing"

# (4) No line in target retains the original sessionId
BAD=$("$PY" - "$TARGET_JSONL" "$ORIG_SESSION_ID" <<'PYEOF'
import json, sys
path, orig = sys.argv[1], sys.argv[2]
with open(path) as f:
    for ln, line in enumerate(f, 1):
        line = line.strip()
        if not line: continue
        try:
            obj = json.loads(line)
        except Exception as e:
            print(f'PARSE_ERROR line {ln}: {e}')
            continue
        if obj.get('sessionId') == orig:
            print(f'line {ln} still has orig sessionId')
PYEOF
)
[[ -z "$BAD" ]] || fail "target .jsonl still references original sessionId: $BAD"

# (5) Every cwd field equals target realpath
TARGET_REAL=$("$PY" -c "import os, sys; print(os.path.realpath(sys.argv[1]))" "$TARGET_DIR")
BAD=$("$PY" - "$TARGET_JSONL" "$TARGET_REAL" <<'PYEOF'
import json, sys
path, want = sys.argv[1], sys.argv[2]
with open(path) as f:
    for ln, line in enumerate(f, 1):
        line = line.strip()
        if not line: continue
        try:
            obj = json.loads(line)
        except Exception:
            continue
        if 'cwd' in obj and obj['cwd'] != want:
            print(f'line {ln}: cwd={obj["cwd"]!r} expected={want!r}')
PYEOF
)
[[ -z "$BAD" ]] || fail "target .jsonl has wrong cwd values: $BAD"

echo "PASS"
