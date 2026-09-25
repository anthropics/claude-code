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

# shellcheck source=common.sh
source "$(dirname "${BASH_SOURCE[0]}")/common.sh"

# Normalize to NFC to match registry storage format (see common.sh nfc_normalize)
REAL_PWD=$(nfc_normalize "$REAL_PWD")

# If hash.txt already exists, verify it is also registered (re-register if not)
if [[ -f "$HASH_FILE" ]]; then
  HASH=$(cat "$HASH_FILE")
  if [[ -n "$HASH" ]]; then
    REGISTERED=$(PRESERVE_REGISTRY="$REGISTRY" PRESERVE_HASH="$HASH" "$PYTHON" - <<'PYEOF'
import json, os
try:
    with open(os.environ["PRESERVE_REGISTRY"]) as f:
        r = json.load(f)
except (FileNotFoundError, json.JSONDecodeError, ValueError):
    r = {}
print(r.get(os.environ["PRESERVE_HASH"], ""))
PYEOF
)
    if [[ -n "$REGISTERED" ]]; then
      exit 0
    fi
    # hash.txt exists but not in registry — fall through to re-register
  else
    # hash.txt exists but is empty — reinitialize
    HASH=$(uuidgen_cross)
    echo "$HASH" > "$HASH_FILE"
  fi
else
  HASH=$(uuidgen_cross)
  echo "$HASH" > "$HASH_FILE"
fi

# Add entry to registry: { "hash": "/current/path", ... }
registry_write "$HASH" "$REAL_PWD"
