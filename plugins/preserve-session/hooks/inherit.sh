#!/usr/bin/env bash
# preserve-session: inherit
# Usage:
#   inherit.sh --list              List other registered projects
#   inherit.sh --from <path>       Copy sessions from the given project path

set -euo pipefail

REGISTRY="$HOME/.claude/project-registry.json"
REAL_PWD=$(realpath "$PWD" 2>/dev/null || echo "$PWD")
HASH_FILE="$REAL_PWD/.claude/hash.txt"

# shellcheck source=common.sh
source "$(dirname "${BASH_SOURCE[0]}")/common.sh"

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
FORCE=false
[[ "${3:-}" == "--force" ]] && FORCE=true

# --- List mode ---

if [[ "$MODE" == "--list" || -z "$MODE" ]]; then
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

# Build slug → [paths] map to detect collisions
all_paths = list(r.values())
slug_map = {}
for p in all_paths:
    s = slug(p)
    slug_map.setdefault(s, []).append(p)

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

# --- From mode ---

if [[ "$MODE" == "--from" ]]; then
  # HOTFIX (v1.1.2): `--from` copy leaves identical sessionId/cwd/parentUuid
  # fields in the copied .jsonl files. Claude Code then treats the copy as
  # the same session as the source, so extending the inherited session can
  # contaminate the original source's history. Block the operation until a
  # proper fix (sessionId + filename + cwd rewrite) is in place.
  cat >&2 <<'HOTFIX_EOF'
⚠️  /preserve-session:inherit --from is temporarily disabled (hotfix v1.1.2).

Reason: the current cp-based copy leaves the source session's sessionId,
parentUuid chain, and cwd unchanged in the copied .jsonl files. Claude Code
2.1.x tracks sessions by sessionId across all projects, so resuming or
extending an "inherited" session can write back into the original source
session's history — the opposite of the intended independent-copy behavior.

A proper fix is being developed (rewrites sessionId, filename, and cwd so
the copy is truly independent). Until that lands, --from is blocked to
prevent contamination of the source session.

For context: plugins/preserve-session/compass/context.md
HOTFIX_EOF
  exit 1
fi

echo "Usage: inherit.sh [--list | --from <path>]"
exit 1
