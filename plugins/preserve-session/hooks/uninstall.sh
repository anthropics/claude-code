#!/usr/bin/env bash
# preserve-session: uninstall
# Removes all files created by preserve-session:
#   - ~/.claude/project-registry.json
#   - ~/.claude/project-registry.json.lock  (if present)
#   - .claude/hash.txt in every registered project directory
#
# Usage:
#   uninstall.sh            Preview — shows what would be deleted (no changes made)
#   uninstall.sh --confirm  Actually delete

set -euo pipefail

REGISTRY="$HOME/.claude/project-registry.json"

# shellcheck source=common.sh
source "$(dirname "${BASH_SOURCE[0]}")/common.sh"

CONFIRM=false
if [[ "${1:-}" == "--confirm" ]]; then
  CONFIRM=true
elif [[ -n "${1:-}" ]]; then
  echo "preserve-session: unrecognized argument '${1}'. Use --confirm to delete." >&2
  exit 1
fi

# --- Registry check ---

if [[ ! -f "$REGISTRY" ]]; then
  echo "preserve-session: registry not found — nothing to uninstall."
  exit 0
fi

# --- Collect registered paths ---

REGISTERED_PATHS=$(PRESERVE_REGISTRY="$REGISTRY" "$PYTHON" - <<'PYEOF'
import json, os, sys

registry_path = os.environ["PRESERVE_REGISTRY"]
try:
    with open(registry_path) as f:
        r = json.load(f)
except FileNotFoundError:
    sys.exit(0)
except (json.JSONDecodeError, ValueError):
    print("preserve-session: WARNING — registry is corrupted.", file=sys.stderr)
    print("  hash.txt files cannot be listed and will not be deleted.", file=sys.stderr)
    print("  Only project-registry.json will be deleted.", file=sys.stderr)
    sys.exit(0)

if not isinstance(r, dict):
    print("preserve-session: WARNING — registry has unexpected format (not a JSON object).", file=sys.stderr)
    print("  Only project-registry.json will be deleted.", file=sys.stderr)
    sys.exit(0)

for path in r.values():
    if not isinstance(path, str):
        print(f"preserve-session: WARNING — skipping non-string value in registry: {repr(path)}", file=sys.stderr)
        continue
    if '\n' in path or '\r' in path:
        print(f"preserve-session: WARNING — skipping malformed path in registry: {repr(path)}", file=sys.stderr)
        continue
    print(path)
PYEOF
)

# Count regular (non-symlink) hash.txt files that actually exist
HASH_COUNT=0
while IFS= read -r path; do
  [[ -z "$path" ]] && continue
  hash_file="$path/.claude/hash.txt"
  [[ -f "$hash_file" ]] && [[ ! -L "$hash_file" ]] && (( HASH_COUNT++ )) || true
done <<< "$REGISTERED_PATHS"

# --- Preview (always shown) ---

echo "The following will be permanently deleted:"
echo ""
echo "  ~/.claude/project-registry.json"
[[ -f "$REGISTRY.lock" ]] && echo "  ~/.claude/project-registry.json.lock"
echo ""
if [[ "$HASH_COUNT" -gt 0 ]]; then
  echo "  .claude/hash.txt in $HASH_COUNT registered project(s):"
  while IFS= read -r path; do
    [[ -z "$path" ]] && continue
    hash_file="$path/.claude/hash.txt"
    [[ -f "$hash_file" ]] && [[ ! -L "$hash_file" ]] && echo "    $hash_file"
  done <<< "$REGISTERED_PATHS"
else
  echo "  (no hash.txt files found in registered paths)"
fi
echo ""
echo "NOT deleted: ~/.claude/projects/ (Claude Code session data is untouched)"

if [[ "$CONFIRM" == false ]]; then
  exit 0
fi

# --- Delete ---

echo ""
echo "Confirmed. Proceeding with deletion..."

DELETED_HASHES=0
FAILED_HASHES=0

while IFS= read -r path; do
  [[ -z "$path" ]] && continue
  hash_file="$path/.claude/hash.txt"
  # Skip if neither a regular file nor a symlink exists at that path
  [[ -e "$hash_file" ]] || [[ -L "$hash_file" ]] || continue

  # Skip symlinks — only delete regular files (guards against corrupted registry entries)
  if [[ -L "$hash_file" ]]; then
    echo "  SKIP (symlink): $hash_file"
    continue
  fi

  # Use if-then to avoid set -e aborting on permission errors
  if rm "$hash_file" 2>/dev/null; then
    echo "  deleted: $hash_file"
    (( DELETED_HASHES++ )) || true
  else
    echo "  FAILED to delete: $hash_file" >&2
    (( FAILED_HASHES++ )) || true
  fi
done <<< "$REGISTERED_PATHS"

# Delete registry after hash.txt loop completes.
# Note: a concurrent registry_write() between the registry rm and lock rm could
# recreate the registry; this is a known benign race — the new entry will simply
# be re-registered on the next session start.
rm -f "$REGISTRY"  # -f: silently succeed if already deleted by a concurrent process
echo "  deleted: $REGISTRY"

if [[ -f "$REGISTRY.lock" ]]; then
  rm -f "$REGISTRY.lock"
  echo "  deleted: $REGISTRY.lock"
fi

echo ""
echo "Done. preserve-session data removed."
echo "  $DELETED_HASHES hash.txt file(s) deleted"
if [[ "$FAILED_HASHES" -gt 0 ]]; then
  echo "  WARNING: $FAILED_HASHES hash.txt file(s) could not be deleted (check permissions)" >&2
fi
echo ""
echo "To reinitialize: run 'claude' in any project to recreate hash.txt and registry."
