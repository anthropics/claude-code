#!/usr/bin/env bash
# preserve-session: shared helpers
# Usage: source "$(dirname "${BASH_SOURCE[0]}")/common.sh"

find_python() {
  for candidate in python3 python /usr/bin/python3 /usr/local/bin/python3; do
    if command -v "$candidate" >/dev/null 2>&1 && \
       "$candidate" -c "import sys; sys.exit(0 if sys.version_info >= (3,6) else 1)" 2>/dev/null; then
      echo "$candidate"
      return 0
    fi
  done
  echo "preserve-session: no usable python3 found" >&2
  exit 1
}

PYTHON=$(find_python)

path_to_slug() {
  local resolved
  resolved=$(realpath "$1" 2>/dev/null || echo "$1")
  "$PYTHON" -c "import re, sys, unicodedata; print(re.sub(r'[^a-zA-Z0-9-]', '-', unicodedata.normalize('NFC', sys.argv[1])))" "$resolved"
}

uuidgen_cross() {
  if command -v uuidgen >/dev/null 2>&1; then
    uuidgen | tr '[:upper:]' '[:lower:]'
  else
    cat /proc/sys/kernel/random/uuid 2>/dev/null || "$PYTHON" -c "import uuid; print(uuid.uuid4())"
  fi
}

# registry_write <hash> <path> [strict]
# Atomically writes hash→path to the registry with an exclusive lock.
# Without "strict" (default): treats missing/corrupt registry as empty — safe for
#   first-run and bulk-init contexts (session-start.sh, scan.sh).
# With "strict": exits with an error message on registry corruption — used where
#   an existing registry is expected (fix.sh).
registry_write() {
  local hash_val="$1"
  local real_pwd="$2"
  local mode="${3:-}"
  if [[ -z "${REGISTRY:-}" ]]; then
    echo "preserve-session: internal error — REGISTRY not set" >&2
    return 1
  fi
  PRESERVE_REGISTRY="$REGISTRY" PRESERVE_HASH="$hash_val" PRESERVE_PATH="$real_pwd" \
  PRESERVE_STRICT="$mode" \
    "$PYTHON" - <<'PYEOF'
import fcntl, json, os, sys, tempfile

registry_path = os.environ["PRESERVE_REGISTRY"]
hash_val      = os.environ["PRESERVE_HASH"]
real_pwd      = os.environ["PRESERVE_PATH"]
strict        = os.environ.get("PRESERVE_STRICT") == "strict"

lock_path = registry_path + ".lock"
with open(lock_path, "a") as lock_f:
    fcntl.flock(lock_f, fcntl.LOCK_EX)
    try:
        with open(registry_path) as f:
            r = json.load(f)
    except FileNotFoundError:
        if strict:
            print("preserve-session: registry not found.", file=sys.stderr)
            sys.exit(1)
        r = {}
    except (json.JSONDecodeError, ValueError):
        if strict:
            print("preserve-session: registry is corrupted. Fix or delete ~/.claude/project-registry.json and retry.", file=sys.stderr)
            sys.exit(1)
        r = {}
    r[hash_val] = real_pwd
    tmp_fd, tmp_path = tempfile.mkstemp(
        dir=os.path.dirname(registry_path), suffix=".tmp"
    )
    try:
        with os.fdopen(tmp_fd, "w") as f:
            json.dump(r, f, indent=2)
        os.replace(tmp_path, registry_path)
    except OSError as e:
        try:
            os.unlink(tmp_path)
        except OSError:
            pass
        print(f"preserve-session: failed to write registry: {e}", file=sys.stderr)
        sys.exit(1)
PYEOF
}

# check_slug_collision <path>
# Prints registered paths that share the same slug as <path> (excluding <path> itself).
# Empty output means no collision.
check_slug_collision() {
  PRESERVE_CHECK_PATH="$1" PRESERVE_REGISTRY="$REGISTRY" "$PYTHON" - <<'PYEOF'
import json, os, re, unicodedata, sys

registry_path = os.environ.get("PRESERVE_REGISTRY", os.path.expanduser("~/.claude/project-registry.json"))
check_path = os.environ["PRESERVE_CHECK_PATH"]

try:
    with open(registry_path) as f:
        r = json.load(f)
except (FileNotFoundError, json.JSONDecodeError, ValueError):
    sys.exit(0)

def slug(p):
    return re.sub(r'[^a-zA-Z0-9-]', '-', unicodedata.normalize('NFC', p))

check_slug = slug(check_path)
for h, p in r.items():
    if p == check_path:
        continue
    if slug(p) == check_slug:
        print(p)
PYEOF
}
