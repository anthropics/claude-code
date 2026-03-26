#!/usr/bin/env bash
# preserve-session: fix
# Recovers session history after a project directory rename or move.
# Also handles copy detection — assigns a new independent hash without touching the original.

set -euo pipefail

REGISTRY="$HOME/.claude/project-registry.json"
REAL_PWD=$(realpath "$PWD" 2>/dev/null || echo "$PWD")
HASH_FILE="$REAL_PWD/.claude/hash.txt"

# --- Helpers ---

path_to_slug() {
  local resolved
  resolved=$(realpath "$1" 2>/dev/null || echo "$1")
  echo "$resolved" | LC_ALL=C sed 's|[^[:alnum:]-]|-|g'
}

uuidgen_cross() {
  if command -v uuidgen &>/dev/null; then
    uuidgen | tr '[:upper:]' '[:lower:]'
  else
    python3 -c "import uuid; print(uuid.uuid4())"
  fi
}

# --- Checks ---

if [[ ! -f "$HASH_FILE" ]]; then
  echo "preserve-session: no hash.txt found in .claude/"
  echo "Run 'claude' once to initialize, or check that the SessionStart hook is installed."
  exit 1
fi

if [[ ! -f "$REGISTRY" ]]; then
  echo "preserve-session: project-registry.json not found at $REGISTRY"
  echo "Run 'claude' once to initialize."
  exit 1
fi

HASH=$(cat "$HASH_FILE")
if [[ -z "$HASH" ]]; then
  echo "preserve-session: hash.txt is empty. Delete it and run 'claude' to reinitialize."
  exit 1
fi

REGISTERED=$(PRESERVE_REGISTRY="$REGISTRY" PRESERVE_HASH="$HASH" python3 - <<'PYEOF'
import json, os
try:
    with open(os.environ["PRESERVE_REGISTRY"]) as f:
        r = json.load(f)
except (json.JSONDecodeError, ValueError):
    r = {}
print(r.get(os.environ["PRESERVE_HASH"], ""))
PYEOF
)

if [[ -z "$REGISTERED" ]]; then
  echo "preserve-session: hash not found in registry. Re-registering current path..."
  PRESERVE_REGISTRY="$REGISTRY" PRESERVE_HASH="$HASH" PRESERVE_PATH="$REAL_PWD" python3 - <<'PYEOF'
import json, os, sys
registry_path = os.environ["PRESERVE_REGISTRY"]
hash_val      = os.environ["PRESERVE_HASH"]
real_pwd      = os.environ["PRESERVE_PATH"]
try:
    with open(registry_path) as f:
        r = json.load(f)
except (json.JSONDecodeError, ValueError):
    print("preserve-session: registry is corrupted. Fix or delete ~/.claude/project-registry.json and retry.", file=sys.stderr)
    sys.exit(1)
r[hash_val] = real_pwd
with open(registry_path, "w") as f:
    json.dump(r, f, indent=2)
PYEOF
  echo "Done. Registered: $REAL_PWD"
  exit 0
fi

if [[ "$REGISTERED" == "$REAL_PWD" ]]; then
  echo "preserve-session: already up to date."
  echo "  hash: $HASH"
  echo "  path: $REAL_PWD"
  exit 0
fi

# --- Detect: copy or rename/move? ---

if [[ -d "$REGISTERED" ]]; then
  # Old path still exists → copy case
  echo "preserve-session: detected copy (original still exists at $REGISTERED)"
  echo "Registering as independent project..."

  NEW_HASH=$(uuidgen_cross)
  echo "$NEW_HASH" > "$HASH_FILE"

  PRESERVE_REGISTRY="$REGISTRY" PRESERVE_HASH="$NEW_HASH" PRESERVE_PATH="$REAL_PWD" python3 - <<'PYEOF'
import json, os, sys
registry_path = os.environ["PRESERVE_REGISTRY"]
hash_val      = os.environ["PRESERVE_HASH"]
real_pwd      = os.environ["PRESERVE_PATH"]
try:
    with open(registry_path) as f:
        r = json.load(f)
except (json.JSONDecodeError, ValueError):
    print("preserve-session: registry is corrupted. Fix or delete ~/.claude/project-registry.json and retry.", file=sys.stderr)
    sys.exit(1)
r[hash_val] = real_pwd
with open(registry_path, "w") as f:
    json.dump(r, f, indent=2)
PYEOF

  echo "Done."
  echo "  new hash: $NEW_HASH"
  echo "  path:     $REAL_PWD"
  echo "  original: $REGISTERED (untouched)"
  echo ""
  echo "To inherit sessions from the original, run: /preserve-session:inherit"

else
  # Old path gone → rename/move case
  echo "preserve-session: detected rename/move"
  echo "  from: $REGISTERED"
  echo "  to:   $REAL_PWD"

  OLD_SLUG=$(path_to_slug "$REGISTERED")
  NEW_SLUG=$(path_to_slug "$REAL_PWD")
  OLD_PROJECTS="$HOME/.claude/projects/$OLD_SLUG"
  NEW_PROJECTS="$HOME/.claude/projects/$NEW_SLUG"

  if [[ -d "$OLD_PROJECTS" ]]; then
    if [[ -d "$NEW_PROJECTS" ]]; then
      echo "  sessions folder already exists at destination — skipping rename"
      echo "  old: $OLD_PROJECTS"
      echo "  new: $NEW_PROJECTS (already exists)"
      echo "  To merge manually, copy *.jsonl files from old to new."
    else
      mv "$OLD_PROJECTS" "$NEW_PROJECTS"
      echo "  sessions folder renamed: $OLD_SLUG → $NEW_SLUG"
    fi
  else
    echo "  (no sessions folder found — nothing to rename)"
  fi

  PRESERVE_REGISTRY="$REGISTRY" PRESERVE_HASH="$HASH" PRESERVE_PATH="$REAL_PWD" python3 - <<'PYEOF'
import json, os, sys
registry_path = os.environ["PRESERVE_REGISTRY"]
hash_val      = os.environ["PRESERVE_HASH"]
real_pwd      = os.environ["PRESERVE_PATH"]
try:
    with open(registry_path) as f:
        r = json.load(f)
except (json.JSONDecodeError, ValueError):
    print("preserve-session: registry is corrupted. Fix or delete ~/.claude/project-registry.json and retry.", file=sys.stderr)
    sys.exit(1)
r[hash_val] = real_pwd
with open(registry_path, "w") as f:
    json.dump(r, f, indent=2)
PYEOF

  echo "Done. Session history recovered."
  echo "You can now use 'claude --resume' or 'claude --continue'."
fi
