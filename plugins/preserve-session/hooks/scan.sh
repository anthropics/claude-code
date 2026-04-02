#!/usr/bin/env bash
# preserve-session: scan
# Usage:
#   scan.sh <dir>                    List unregistered projects under <dir>
#   scan.sh --init <path1> [path2]   Initialize selected paths with hash.txt

set -euo pipefail

REGISTRY="$HOME/.claude/project-registry.json"

# shellcheck source=common.sh
source "$(dirname "${BASH_SOURCE[0]}")/common.sh"

MODE="${1:-}"

# --- Scan mode ---

if [[ "$MODE" != "--init" ]]; then
  DIR="${1:-}"
  if [[ -z "$DIR" ]]; then
    echo "Usage: scan.sh <dir>"
    exit 1
  fi

  DIR=$(realpath "$DIR" 2>/dev/null || echo "$DIR")

  if [[ ! -d "$DIR" ]]; then
    echo "preserve-session: directory not found: $DIR"
    exit 1
  fi

  PRESERVE_DIR="$DIR" "$PYTHON" - <<'PYEOF'
import os, json, sys

scan_dir = os.environ["PRESERVE_DIR"]
registry_path = os.path.expanduser("~/.claude/project-registry.json")

try:
    with open(registry_path) as f:
        registry = json.load(f)
except (FileNotFoundError, json.JSONDecodeError, ValueError):
    registry = {}

registered_paths = set(registry.values())

unregistered = []
for entry in sorted(os.scandir(scan_dir), key=lambda e: e.name):
    if not entry.is_dir(follow_symlinks=False):
        continue
    if entry.name.startswith('.'):
        continue
    path = os.path.realpath(entry.path)
    hash_file = os.path.join(path, ".claude", "hash.txt")
    if not os.path.isfile(hash_file) and path not in registered_paths:
        unregistered.append(path)

if not unregistered:
    print(f"preserve-session: no unregistered projects found under {scan_dir}")
    sys.exit(0)

print(f"Unregistered projects under {scan_dir}:")
print("")
for i, p in enumerate(unregistered, 1):
    print(f"  {i}. {p}")
print("")
print(f"Total: {len(unregistered)} project(s)")
print("")
print("Reply with numbers (e.g. 1 3 5), 'all', or describe your selection.")
PYEOF
  exit 0
fi

# --- Init mode ---

shift  # remove --init
if [[ $# -eq 0 ]]; then
  echo "Usage: scan.sh --init <path1> [path2 ...]"
  exit 1
fi

INITIALIZED=0
SKIPPED=0

for TARGET in "$@"; do
  TARGET=$(realpath "$TARGET" 2>/dev/null || echo "$TARGET")

  if [[ ! -d "$TARGET" ]]; then
    echo "  skip: $TARGET (directory not found)"
    (( SKIPPED++ )) || true
    continue
  fi

  HASH_FILE="$TARGET/.claude/hash.txt"

  if [[ -f "$HASH_FILE" ]]; then
    echo "  skip: $TARGET (already initialized)"
    (( SKIPPED++ )) || true
    continue
  fi

  mkdir -p "$TARGET/.claude"
  HASH=$(uuidgen_cross)

  # Write registry first — if this fails, hash.txt stays absent (no inconsistency)
  registry_write "$HASH" "$TARGET"
  echo "$HASH" > "$HASH_FILE"

  echo "  initialized: $TARGET"
  (( INITIALIZED++ )) || true
done

echo ""
echo "Done. initialized: $INITIALIZED, skipped: $SKIPPED"
