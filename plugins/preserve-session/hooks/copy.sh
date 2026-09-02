#!/usr/bin/env bash
# preserve-session: copy
# Creates independent session copies from another registered project into the
# current one. Each copied .jsonl gets a fresh sessionId, a new matching filename,
# and its cwd fields rewritten to the current project's realpath.
#
# Usage:
#   copy.sh                         # list available source projects
#   copy.sh --list                  # same as above
#   copy.sh <source-path>           # copy sessions from <source-path>
#   copy.sh <source-path> --force   # proceed despite slug collision

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
    print("preserve-session: registry is corrupted. Fix or delete ~/.claude/project-registry.json and retry.")
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

# --- Copy mode ---

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

# Slug collision check (as in the original inherit design)
COLLISION=$(check_slug_collision "$SOURCE_PATH")
if [[ -n "$COLLISION" ]]; then
  echo "preserve-session: warning — source slug collides with:"
  while IFS= read -r line; do
    echo "  $line"
  done <<< "$COLLISION"
  echo "  Sessions from these projects share the same folder."
  echo "  Copying will also bring in sessions from the above project(s)."
  if [[ "$FORCE" == false ]]; then
    echo ""
    echo "  To proceed anyway, run: /preserve-session:copy <path> --force"
    exit 1
  fi
  echo "  Proceeding with --force."
fi

mkdir -p "$CURRENT_PROJECTS"

COUNTS=$(PRESERVE_SRC_DIR="$SOURCE_PROJECTS" \
         PRESERVE_DST_DIR="$CURRENT_PROJECTS" \
         PRESERVE_DST_REAL="$REAL_PWD" \
         "$PYTHON" - <<'PYEOF'
import json, os, sys, uuid

src_dir = os.environ["PRESERVE_SRC_DIR"]
dst_dir = os.environ["PRESERVE_DST_DIR"]
dst_real = os.environ["PRESERVE_DST_REAL"]

copied = 0
errors = 0
for fname in sorted(os.listdir(src_dir)):
    if not fname.endswith(".jsonl"):
        continue
    src_path = os.path.join(src_dir, fname)
    # Generate a fresh sessionId (and filename) for each source file
    new_sid = str(uuid.uuid4())
    dst_path = os.path.join(dst_dir, f"{new_sid}.jsonl")
    while os.path.exists(dst_path):
        new_sid = str(uuid.uuid4())
        dst_path = os.path.join(dst_dir, f"{new_sid}.jsonl")
    try:
        with open(src_path, 'r') as fi, open(dst_path, 'w') as fo:
            for line in fi:
                s = line.rstrip('\n')
                if not s:
                    fo.write('\n')
                    continue
                try:
                    obj = json.loads(s)
                except Exception:
                    # Keep non-JSON lines verbatim — don't risk losing data
                    fo.write(line if line.endswith('\n') else line + '\n')
                    continue
                if 'sessionId' in obj:
                    obj['sessionId'] = new_sid
                if 'cwd' in obj:
                    obj['cwd'] = dst_real
                fo.write(json.dumps(obj, ensure_ascii=False) + '\n')
        copied += 1
    except OSError as e:
        print(f"preserve-session: error copying {fname}: {e}", file=sys.stderr)
        errors += 1

print(f"{copied} {errors}")
PYEOF
)

COPIED=$(echo "$COUNTS" | awk '{print $1}')
ERRORS=$(echo "$COUNTS" | awk '{print $2}')

echo "Done."
echo "  source:  $SOURCE_PATH"
echo "  copied:  $COPIED session(s)"
[[ "${ERRORS:-0}" -gt 0 ]] && echo "  errors:  $ERRORS"
echo ""
echo "Use 'claude --resume' to browse copied sessions."
