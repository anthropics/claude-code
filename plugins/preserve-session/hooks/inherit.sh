#!/usr/bin/env bash
# preserve-session: inherit
# Usage:
#   inherit.sh --list              List other registered projects
#   inherit.sh --from <path>       Copy sessions from the given project path

set -euo pipefail

REGISTRY="$HOME/.claude/project-registry.json"
REAL_PWD=$(realpath "$PWD" 2>/dev/null || echo "$PWD")
HASH_FILE="$REAL_PWD/.claude/hash.txt"

path_to_slug() {
  local resolved
  resolved=$(realpath "$1" 2>/dev/null || echo "$1")
  echo "$resolved" | LC_ALL=C sed 's|[^[:alnum:]-]|-|g'
}

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
SOURCE_PATH="${2:-}"

# --- List mode ---

if [[ "$MODE" == "--list" || -z "$MODE" ]]; then
  PRESERVE_HASH="$CURRENT_HASH" python3 - <<'PYEOF'
import json, os, re, sys

registry_path = os.path.expanduser("~/.claude/project-registry.json")
try:
    with open(registry_path) as f:
        r = json.load(f)
except (json.JSONDecodeError, ValueError):
    print("preserve-session: registry is corrupted. Fix or delete ~/.claude/project-registry.json and retry.")
    sys.exit(1)

current_hash = os.environ["PRESERVE_HASH"]
projects = [(h, p) for h, p in r.items() if h != current_hash]

if not projects:
    print("preserve-session: no other registered projects found.")
else:
    print("Available projects:")
    print("")
    for h, p in sorted(projects, key=lambda x: x[1]):
        slug = re.sub(r'[^a-zA-Z0-9-]', '-', p)
        sessions_dir = os.path.expanduser(f"~/.claude/projects/{slug}")
        count = len([f for f in os.listdir(sessions_dir) if f.endswith(".jsonl")]) if os.path.isdir(sessions_dir) else 0
        exists = "\u2713" if os.path.isdir(p) else "\u2717"
        print(f"  {exists}  {p}  ({count} sessions)")
PYEOF
  exit 0
fi

# --- From mode ---

if [[ "$MODE" == "--from" ]]; then
  if [[ -z "$SOURCE_PATH" ]]; then
    echo "Usage: inherit.sh --from <path>"
    exit 1
  fi

  SOURCE_PATH=$(realpath "$SOURCE_PATH" 2>/dev/null || echo "$SOURCE_PATH")

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

  mkdir -p "$CURRENT_PROJECTS"

  COPIED=0
  SKIPPED=0

  for f in "$SOURCE_PROJECTS"/*.jsonl; do
    [[ -e "$f" ]] || continue
    BASENAME=$(basename "$f")
    DEST="$CURRENT_PROJECTS/$BASENAME"
    if [[ -f "$DEST" ]]; then
      (( SKIPPED++ )) || true
    else
      cp "$f" "$DEST"
      (( COPIED++ )) || true
    fi
  done

  echo "Done."
  echo "  source:  $SOURCE_PATH"
  echo "  copied:  $COPIED session(s)"
  [[ $SKIPPED -gt 0 ]] && echo "  skipped: $SKIPPED (already exist in destination)"
  echo ""
  echo "Use 'claude --resume' to browse inherited sessions."
  exit 0
fi

echo "Usage: inherit.sh [--list | --from <path>]"
exit 1
