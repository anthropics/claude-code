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

# nfc_normalize <path>
# Prints <path> NFC-normalized. Needed because macOS realpath returns NFD, but
# Claude Code / the plugin use NFC for slug computation and registry storage.
# Comparing a freshly resolved realpath against a registry value without this
# can produce false negatives on non-ASCII paths.
nfc_normalize() {
  "$PYTHON" -c "import sys, unicodedata; print(unicodedata.normalize('NFC', sys.argv[1]))" "$1"
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
import fcntl, json, os, sys, tempfile, unicodedata

registry_path = os.environ["PRESERVE_REGISTRY"]
hash_val      = os.environ["PRESERVE_HASH"]
real_pwd      = unicodedata.normalize('NFC', os.environ["PRESERVE_PATH"])
strict        = os.environ.get("PRESERVE_STRICT") == "strict"

lock_path = registry_path + ".lock"
with open(lock_path, "a") as lock_f:
    fcntl.flock(lock_f, fcntl.LOCK_EX)
    def _backup_corrupt(reason):
        # Preserve the corrupt file so the user can inspect/recover it
        # instead of silently resetting to {}. Used in non-strict mode
        # (session-start / scan) where we must keep working.
        import time
        backup = registry_path + ".corrupt-backup." + str(int(time.time()))
        try:
            os.rename(registry_path, backup)
            print(f"preserve-session: registry was {reason}, backed up to {backup}", file=sys.stderr)
        except OSError as e:
            # Backup failed (permissions?) — warn explicitly so the user
            # knows the recovery guarantee didn't hold before we overwrite.
            print(f"preserve-session: registry was {reason}, but backup to {backup} failed: {e}. The corrupt content will be overwritten.", file=sys.stderr)
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
        _backup_corrupt("corrupt JSON")
        r = {}
    if not isinstance(r, dict):
        if strict:
            print("preserve-session: registry has unexpected format (not a JSON object).", file=sys.stderr)
            sys.exit(1)
        _backup_corrupt("not a JSON object")
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
# Defensive NFC normalization — callers are expected to pass NFC, but a stray
# NFD input would otherwise cause self-exclusion (p == check_path) to miss.
check_path = unicodedata.normalize('NFC', os.environ["PRESERVE_CHECK_PATH"])

try:
    with open(registry_path) as f:
        r = json.load(f)
except (FileNotFoundError, json.JSONDecodeError, ValueError):
    sys.exit(0)

if not isinstance(r, dict):
    sys.exit(0)

def slug(p):
    return re.sub(r'[^a-zA-Z0-9-]', '-', unicodedata.normalize('NFC', p))

check_slug = slug(check_path)
for h, p in r.items():
    if not isinstance(p, str):
        continue
    # NFC-normalize for comparison so legacy NFD registry entries still
    # self-exclude against an NFC check_path (avoids false positive
    # "self-collision" reports from pre-B2 registries).
    if unicodedata.normalize('NFC', p) == check_path:
        continue
    if slug(p) == check_slug:
        print(p)
PYEOF
}
