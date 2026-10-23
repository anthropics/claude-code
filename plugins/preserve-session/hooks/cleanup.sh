#!/usr/bin/env bash
# preserve-session: cleanup (v2)
# Usage:
#   cleanup.sh                                         List all registered projects with status + session count
#   cleanup.sh --remove <path1> [...]                  Remove registry entries only (preserve slug folders)
#   cleanup.sh --remove-with-sessions <path1> [...]    Remove registry entries + slug folders (stale only)

set -euo pipefail

REGISTRY="$HOME/.claude/project-registry.json"

# shellcheck source=common.sh
source "$(dirname "${BASH_SOURCE[0]}")/common.sh"

MODE="${1:-}"

# --- List mode (default) ---

if [[ -z "$MODE" ]]; then
  if [[ ! -f "$REGISTRY" ]]; then
    echo "preserve-session: registry not found — nothing to clean up."
    exit 0
  fi

  PRESERVE_REGISTRY="$REGISTRY" PRESERVE_HOME="$HOME" "$PYTHON" - <<'PYEOF'
import json, os, re, sys, unicodedata

registry_path = os.environ["PRESERVE_REGISTRY"]
home = os.environ["PRESERVE_HOME"]

try:
    with open(registry_path) as f:
        r = json.load(f)
except FileNotFoundError:
    print("preserve-session: registry not found — nothing to clean up.")
    sys.exit(0)
except (json.JSONDecodeError, ValueError):
    print("preserve-session: registry is corrupted. Fix or delete ~/.claude/project-registry.json and retry.", file=sys.stderr)
    sys.exit(1)

if not isinstance(r, dict):
    print("preserve-session: registry has unexpected format (not a JSON object).", file=sys.stderr)
    sys.exit(1)

if not r:
    print("preserve-session: registry is empty — nothing to clean up.")
    sys.exit(0)

def slug(p):
    return re.sub(r'[^a-zA-Z0-9-]', '-', unicodedata.normalize('NFC', p))

def count_sessions(p):
    try:
        s = slug(p)
    except Exception:
        return None
    proj_dir = os.path.join(home, ".claude", "projects", s)
    if not os.path.isdir(proj_dir):
        return 0
    try:
        return sum(1 for f in os.listdir(proj_dir) if f.endswith(".jsonl"))
    except OSError:
        return None

entries = []
stale_count = 0
for h, p in r.items():
    if not isinstance(p, str):
        continue
    exists = os.path.isdir(p)
    if not exists:
        stale_count += 1
    cnt = count_sessions(p)
    entries.append((h, p, exists, cnt))

total = len(entries)
print(f"Registered projects ({total} total, {stale_count} stale):")
print("")
for i, (h, p, exists, cnt) in enumerate(entries, 1):
    status = "\u2713" if exists else "\u2717"
    if cnt is None:
        sess = ""
    elif cnt == 0 and not exists:
        sess = "  (0 sessions — auto-cleaned)"
    elif not exists:
        sess = f"  ({cnt} sessions still in slug)"
    else:
        sess = f"  ({cnt} sessions)"
    note = "  \u2190 path not found" if not exists else ""
    print(f"  {i:3}. {status}  {p}  [{h[:8]}]{sess}{note}")
print("")
if stale_count > 0:
    stale_part = f", 'stale' (remove {stale_count} stale)"
else:
    stale_part = ""
print(f"Select entries to remove: numbers (e.g. 1 3){stale_part}, or 'all' (remove all {total}).")
PYEOF
  exit 0
fi

# --- Remove / Remove-with-sessions mode ---

case "$MODE" in
  --remove|--remove-with-sessions) ;;
  *)
    echo "preserve-session: unrecognized argument '$MODE'." >&2
    echo "Usage: cleanup.sh [--remove | --remove-with-sessions] <path> ..." >&2
    exit 1
    ;;
esac

WITH_SESSIONS=false
[[ "$MODE" == "--remove-with-sessions" ]] && WITH_SESSIONS=true

shift
if [[ $# -eq 0 ]]; then
  echo "Usage: cleanup.sh $MODE <path1> [path2 ...]" >&2
  exit 1
fi

PRESERVE_REMOVE=$(printf '%s\n' "$@") \
PRESERVE_REGISTRY="$REGISTRY" \
PRESERVE_HOME="$HOME" \
PRESERVE_WITH_SESSIONS=$([[ "$WITH_SESSIONS" == true ]] && echo "1" || echo "0") \
  "$PYTHON" - <<'PYEOF'
import fcntl, json, os, re, shutil, sys, tempfile, unicodedata

registry_path = os.environ["PRESERVE_REGISTRY"]
home = os.environ["PRESERVE_HOME"]
# NFC-normalize input paths to match registry storage (registry_write also NFC)
paths_to_remove = {
    unicodedata.normalize('NFC', p)
    for p in os.environ["PRESERVE_REMOVE"].splitlines() if p
}
with_sessions = os.environ["PRESERVE_WITH_SESSIONS"] == "1"

def slug(p):
    return re.sub(r'[^a-zA-Z0-9-]', '-', unicodedata.normalize('NFC', p))

lock_path = registry_path + ".lock"
with open(lock_path, "a") as lock_f:
    fcntl.flock(lock_f, fcntl.LOCK_EX)
    try:
        with open(registry_path) as f:
            r = json.load(f)
    except FileNotFoundError:
        print("preserve-session: registry not found.", file=sys.stderr)
        sys.exit(1)
    except (json.JSONDecodeError, ValueError):
        print("preserve-session: registry is corrupted.", file=sys.stderr)
        sys.exit(1)

    if not isinstance(r, dict):
        print("preserve-session: registry has unexpected format.", file=sys.stderr)
        sys.exit(1)

    registered_paths = {p for p in r.values() if isinstance(p, str)}
    not_found = [p for p in paths_to_remove if p not in registered_paths]

    new_r = {h: p for h, p in r.items() if p not in paths_to_remove}
    removed_count = len(r) - len(new_r)

    header = "Removing {} entry(entries){}...".format(
        removed_count,
        " (with session folders)" if with_sessions else "",
    )
    print(header)
    print("")

    slug_stats = {"removed": 0, "skipped_alive": 0, "skipped_shared": 0, "skipped_symlink": 0, "skipped_missing": 0, "failed": 0}

    # Precompute slug → [alive sibling paths] for shared-slug guard.
    # Two distinct registry entries can map to the same slug (e.g. non-ASCII
    # paths with identical character counts). Removing a stale one must not
    # rmtree the slug folder if an alive sibling still uses it.
    alive_slug_map = {}
    for h_other, p_other in r.items():
        if not isinstance(p_other, str):
            continue
        if p_other in paths_to_remove:
            continue
        if not os.path.isdir(p_other):
            continue
        try:
            s_other = slug(p_other)
        except Exception:
            continue
        alive_slug_map.setdefault(s_other, []).append(p_other)

    for h, p in r.items():
        if p not in paths_to_remove:
            continue
        print(f"  removed registry: {p}")

        if not with_sessions:
            continue

        if os.path.isdir(p):
            print(f"    SKIP slug: project path still exists — {p}")
            slug_stats["skipped_alive"] += 1
            continue

        try:
            s = slug(p)
        except Exception as e:
            print(f"    SKIP slug: cannot compute slug for {p}: {e}", file=sys.stderr)
            slug_stats["failed"] += 1
            continue

        shared_alive = alive_slug_map.get(s, [])
        if shared_alive:
            print(f"    SKIP slug: shared with alive project(s) — {shared_alive[0]}")
            slug_stats["skipped_shared"] += 1
            continue

        proj_dir = os.path.join(home, ".claude", "projects", s)

        if os.path.islink(proj_dir):
            print(f"    SKIP slug: {proj_dir} is a symlink")
            slug_stats["skipped_symlink"] += 1
            continue

        if not os.path.isdir(proj_dir):
            print(f"    SKIP slug: {proj_dir} already missing")
            slug_stats["skipped_missing"] += 1
            continue

        try:
            try:
                file_count = sum(1 for f in os.listdir(proj_dir) if f.endswith(".jsonl"))
            except OSError:
                file_count = 0
            shutil.rmtree(proj_dir)
            print(f"    removed slug:     {proj_dir} ({file_count} file(s))")
            slug_stats["removed"] += 1
        except OSError as e:
            print(f"    FAILED slug: {proj_dir}: {e}", file=sys.stderr)
            slug_stats["failed"] += 1

    for p in not_found:
        print(f"  WARNING: not found in registry: {p}")

    tmp_fd, tmp_path = tempfile.mkstemp(
        dir=os.path.dirname(registry_path), suffix=".tmp"
    )
    try:
        with os.fdopen(tmp_fd, "w") as f:
            json.dump(new_r, f, indent=2)
        os.replace(tmp_path, registry_path)
    except OSError as e:
        try:
            os.unlink(tmp_path)
        except OSError:
            pass
        print(f"preserve-session: failed to write registry: {e}", file=sys.stderr)
        sys.exit(1)

print("")
kept = len(new_r)
parts = [f"{removed_count} registry entry(entries) removed"]
if with_sessions:
    parts.append(f"{slug_stats['removed']} slug folder(s) removed")
    if slug_stats["skipped_alive"] > 0:
        parts.append(f"{slug_stats['skipped_alive']} skipped (path still alive)")
    if slug_stats["skipped_shared"] > 0:
        parts.append(f"{slug_stats['skipped_shared']} skipped (shared slug with alive project)")
    if slug_stats["skipped_symlink"] > 0:
        parts.append(f"{slug_stats['skipped_symlink']} skipped (symlink)")
    if slug_stats["skipped_missing"] > 0:
        parts.append(f"{slug_stats['skipped_missing']} already missing")
    if slug_stats["failed"] > 0:
        parts.append(f"{slug_stats['failed']} failed")
print("Done. " + ". ".join(parts) + ".")
print(f"  {kept} entry(entries) kept.")
if not_found:
    print(f"  {len(not_found)} path(s) not found in registry.")
PYEOF
