#!/usr/bin/env bash
# preserve-session: SessionStart hook
# Creates a project-unique hash and registers it in the global registry.

set -euo pipefail

REGISTRY="$HOME/.claude/project-registry.json"
REAL_PWD=$(realpath "$PWD" 2>/dev/null || echo "$PWD")
CLAUDE_DIR="$REAL_PWD/.claude"
HASH_FILE="$CLAUDE_DIR/hash.txt"

# Ensure .claude/ directory exists
mkdir -p "$CLAUDE_DIR"

# Generate a UUID (cross-platform)
uuidgen_cross() {
  if command -v uuidgen &>/dev/null; then
    uuidgen | tr '[:upper:]' '[:lower:]'
  else
    cat /proc/sys/kernel/random/uuid 2>/dev/null || python3 -c "import uuid; print(uuid.uuid4())"
  fi
}

# Initialize registry if it doesn't exist
if [[ ! -f "$REGISTRY" ]]; then
  echo '{}' > "$REGISTRY"
fi

# If hash.txt already exists, verify it is also registered (re-register if not)
if [[ -f "$HASH_FILE" ]]; then
  HASH=$(cat "$HASH_FILE")
  if [[ -n "$HASH" ]]; then
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
    if [[ -n "$REGISTERED" ]]; then
      exit 0
    fi
    # hash.txt exists but not in registry — fall through to re-register
  fi
else
  HASH=$(uuidgen_cross)
  echo "$HASH" > "$HASH_FILE"
fi

# Add entry to registry: { "hash": "/current/path", ... }
PRESERVE_REGISTRY="$REGISTRY" PRESERVE_HASH="$HASH" PRESERVE_PATH="$REAL_PWD" python3 - <<'PYEOF'
import json, os, sys

registry_path = os.environ["PRESERVE_REGISTRY"]
hash_val      = os.environ["PRESERVE_HASH"]
real_pwd      = os.environ["PRESERVE_PATH"]

try:
    with open(registry_path) as f:
        registry = json.load(f)
except (json.JSONDecodeError, ValueError):
    registry = {}

registry[hash_val] = real_pwd

try:
    with open(registry_path, "w") as f:
        json.dump(registry, f, indent=2)
except OSError as e:
    print(f"preserve-session: failed to write registry: {e}", file=sys.stderr)
    sys.exit(1)
PYEOF
