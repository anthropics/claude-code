#!/usr/bin/env bash
# test-slug-collision.sh
#
# TDD test for common.sh check_slug_collision's NFC-aware self-exclusion
# (H-C, v1.3.1). A registry entry stored in legacy NFD bytes that points to
# the same project as an NFC check_path MUST self-exclude — otherwise the
# caller (doctor/fix/copy/move) sees a false positive "self-collision".

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

REGISTRY="$FAKE_HOME/.claude/project-registry.json"
mkdir -p "$FAKE_HOME/.claude"

# Craft a registry with the SAME logical path stored as NFD (legacy state).
# check_path will be NFC. Without the H-C fix, the raw == comparison fails
# and check_slug_collision emits the NFD entry as a collision result.
"$PY" - <<PYEOF
import json, unicodedata
nfc_path = '/Users/won/한글프로젝트'
nfd_path = unicodedata.normalize('NFD', nfc_path)
assert nfc_path != nfd_path, "TEST SETUP: NFC == NFD; pick a path with composable Hangul syllables"
d = {'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa': nfd_path}
open('$REGISTRY', 'w').write(json.dumps(d, indent=2, ensure_ascii=False))
PYEOF

# Invoke check_slug_collision with the NFC form of the same path.
OUTPUT=$(HOME="$FAKE_HOME" REGISTRY="$REGISTRY" bash -c "
  source '$COMMON_SH'
  check_slug_collision '/Users/won/한글프로젝트'
")

[[ -z "$OUTPUT" ]] \
  || fail "check_slug_collision false positive on legacy NFD self-entry. Output:
$OUTPUT"

# Sanity: a genuinely-different NFD path with the same slug MUST still be reported.
"$PY" - <<PYEOF
import json, unicodedata
d = {
  'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa': unicodedata.normalize('NFD', '/Users/won/한글프로젝트'),
  'bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbbbbb': unicodedata.normalize('NFD', '/Users/won/다른프로젝트'),
}
open('$REGISTRY', 'w').write(json.dumps(d, indent=2, ensure_ascii=False))
PYEOF

OUTPUT=$(HOME="$FAKE_HOME" REGISTRY="$REGISTRY" bash -c "
  source '$COMMON_SH'
  check_slug_collision '/Users/won/한글프로젝트'
")
# Both 한글프로젝트 and 다른프로젝트 are 6 non-ASCII chars → same slug.
# Output bytes are NFD (registry stored that way); match on the ASCII prefix +
# presence of "다른" in EITHER normalization form.
[[ -n "$OUTPUT" ]] \
  || fail "check_slug_collision missed a real collision with a different NFD entry"
echo "$OUTPUT" | grep -q '/Users/won/' \
  || fail "check_slug_collision output did not include the colliding registry path. Output:
$OUTPUT"
# Confirm it is NOT the self path (which is 한글프로젝트, not 다른프로젝트)
MATCH=$("$PY" -c "
import sys, unicodedata
out = sys.argv[1]
out_nfc = unicodedata.normalize('NFC', out)
print('yes' if '다른프로젝트' in out_nfc else 'no')
" "$OUTPUT")
[[ "$MATCH" == "yes" ]] \
  || fail "check_slug_collision returned self instead of the different entry. Output:
$OUTPUT"

echo "PASS"
