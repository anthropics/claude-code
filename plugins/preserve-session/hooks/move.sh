#!/usr/bin/env bash
# preserve-session: move
# Migrates session files from another registered project into the current one.
# Destructive: the source slug folder ends up empty (files are moved, not copied).
# Semantics (simple — sessionId and filename are preserved; only cwd is rewritten
# for Ctrl+A picker filter correctness).
#
# Usage:
#   move.sh                         # list available source projects
#   move.sh --list                  # same as above
#   move.sh <source-path>           # move sessions from <source-path>
#   move.sh <source-path> --force   # proceed despite slug collision

set -euo pipefail

REGISTRY="$HOME/.claude/project-registry.json"
REAL_PWD=$(realpath "$PWD" 2>/dev/null || echo "$PWD")
HASH_FILE="$REAL_PWD/.claude/hash.txt"

# shellcheck source=common.sh
source "$(dirname "${BASH_SOURCE[0]}")/common.sh"

# Normalize to NFC to match registry storage format (see common.sh nfc_normalize)
REAL_PWD=$(nfc_normalize "$REAL_PWD")

# --- Checks ---

if [[ ! -f "$HASH_FILE" ]]; then
  echo "preserve-session: no hash.txt found in .claude/"
  echo "Run 'claude' once to initialize."
  exit 1
fi

if [[ ! -f "$REGISTRY" ]]; then
  echo "preserve-session: project-registry.json not found at $REGISTRY"
  exit 1
fi

CURRENT_HASH=$(cat "$HASH_FILE")
CURRENT_SLUG=$(path_to_slug "$REAL_PWD")
CURRENT_PROJECTS="$HOME/.claude/projects/$CURRENT_SLUG"

MODE="${1:-}"
FORCE=false
[[ "${2:-}" == "--force" ]] && FORCE=true

# --- List mode ---

if [[ -z "$MODE" || "$MODE" == "--list" ]]; then
  PRESERVE_HASH="$CURRENT_HASH" "$PYTHON" - <<'PYEOF'
import json, os, re, sys, unicodedata

registry_path = os.path.expanduser("~/.claude/project-registry.json")
try:
    with open(registry_path) as f:
        r = json.load(f)
except (json.JSONDecodeError, ValueError):
    print("preserve-session: registry is corrupted.")
    sys.exit(1)

def slug(p):
    return re.sub(r'[^a-zA-Z0-9-]', '-', unicodedata.normalize('NFC', p))

current_hash = os.environ["PRESERVE_HASH"]
projects = [(h, p) for h, p in r.items() if h != current_hash]

slug_map = {}
for p in r.values():
    slug_map.setdefault(slug(p), []).append(p)

if not projects:
    print("preserve-session: no other registered projects found.")
else:
    print("Available projects:")
    print("")
    for h, p in sorted(projects, key=lambda x: x[1]):
        s = slug(p)
        sessions_dir = os.path.expanduser(f"~/.claude/projects/{s}")
        count = len([f for f in os.listdir(sessions_dir) if f.endswith(".jsonl")]) if os.path.isdir(sessions_dir) else 0
        exists = "\u2713" if os.path.isdir(p) else "\u2717"
        collision = len(slug_map.get(s, [])) > 1
        warn = "  \u26a0\ufe0f  slug collision" if collision else ""
        print(f"  {exists}  {p}  ({count} sessions){warn}")
PYEOF
  exit 0
fi

# --- Move mode ---

SOURCE_PATH=$(realpath "$MODE" 2>/dev/null || echo "$MODE")
SOURCE_PATH=$(nfc_normalize "$SOURCE_PATH")

if [[ "$SOURCE_PATH" == "$REAL_PWD" ]]; then
  echo "preserve-session: source and destination are the same project."
  exit 1
fi

SOURCE_SLUG=$(path_to_slug "$SOURCE_PATH")
SOURCE_PROJECTS="$HOME/.claude/projects/$SOURCE_SLUG"

if [[ ! -d "$SOURCE_PROJECTS" ]]; then
  echo "preserve-session: no sessions folder found for $SOURCE_PATH"
  exit 1
fi

COLLISION=$(check_slug_collision "$SOURCE_PATH")
if [[ -n "$COLLISION" ]]; then
  echo "preserve-session: warning — source slug collides with:"
  while IFS= read -r line; do
    echo "  $line"
  done <<< "$COLLISION"
  echo "  Sessions from these projects share the same folder."
  echo "  Moving will migrate sessions from the above project(s) too."
  if [[ "$FORCE" == false ]]; then
    echo ""
    echo "  To proceed anyway, run: /preserve-session:move <path> --force"
    exit 1
  fi
  echo "  Proceeding with --force."
fi

mkdir -p "$CURRENT_PROJECTS"

COUNTS=$(PRESERVE_SRC_DIR="$SOURCE_PROJECTS" \
         PRESERVE_DST_DIR="$CURRENT_PROJECTS" \
         PRESERVE_DST_REAL="$REAL_PWD" \
         "$PYTHON" - <<'PYEOF'
import json, os, sys, tempfile

src_dir = os.environ["PRESERVE_SRC_DIR"]
dst_dir = os.environ["PRESERVE_DST_DIR"]
dst_real = os.environ["PRESERVE_DST_REAL"]

moved = 0
skipped = 0
errors = 0

for fname in sorted(os.listdir(src_dir)):
    if not fname.endswith(".jsonl"):
        continue
    src_path = os.path.join(src_dir, fname)
    dst_path = os.path.join(dst_dir, fname)

    # If dst already has same-name file, skip (avoid silent overwrite).
    # Rare: possible only when user already has an unrelated .jsonl with the
    # exact same UUID filename. Preserve both by skipping.
    if os.path.exists(dst_path):
        skipped += 1
        continue

    try:
        # Rewrite cwd to destination, then atomically replace source position
        tmp_fd, tmp_path = tempfile.mkstemp(
            dir=dst_dir, prefix=".move-tmp.", suffix=".jsonl"
        )
        try:
            with os.fdopen(tmp_fd, 'w') as fo, open(src_path, 'r') as fi:
                for line in fi:
                    s = line.rstrip('\n')
                    if not s:
                        fo.write('\n')
                        continue
                    try:
                        obj = json.loads(s)
                    except Exception:
                        fo.write(line if line.endswith('\n') else line + '\n')
                        continue
                    if 'cwd' in obj:
                        obj['cwd'] = dst_real
                    fo.write(json.dumps(obj, ensure_ascii=False) + '\n')
            os.replace(tmp_path, dst_path)
        except Exception:
            try: os.unlink(tmp_path)
            except OSError: pass
            raise

        # Source file remove (move semantics)
        os.unlink(src_path)
        moved += 1
    except OSError as e:
        print(f"preserve-session: error moving {fname}: {e}", file=sys.stderr)
        errors += 1

print(f"{moved} {skipped} {errors}")
PYEOF
)

MOVED=$(echo "$COUNTS" | awk '{print $1}')
SKIPPED=$(echo "$COUNTS" | awk '{print $2}')
ERRORS=$(echo "$COUNTS" | awk '{print $3}')

# If source slug dir is now empty, remove it so it doesn't linger as an empty
# ghost (and so Ctrl+A picker doesn't show a stale project with 0 sessions).
if [[ -d "$SOURCE_PROJECTS" ]]; then
  REMAINING=$(ls -A "$SOURCE_PROJECTS" 2>/dev/null | wc -l | tr -d ' ')
  if [[ "$REMAINING" -eq 0 ]]; then
    rmdir "$SOURCE_PROJECTS" 2>/dev/null || true
  fi
fi

echo "Done."
echo "  source:  $SOURCE_PATH"
echo "  moved:   $MOVED session(s)"
[[ "${SKIPPED:-0}" -gt 0 ]] && echo "  skipped: $SKIPPED (destination already had same filename)"
[[ "${ERRORS:-0}" -gt 0 ]] && echo "  errors:  $ERRORS"
echo ""
echo "Source session files are no longer at $SOURCE_PATH."
echo "Use 'claude --resume' in the current project to open them."
