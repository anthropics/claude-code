#!/usr/bin/env bash
# preserve-session: fix
# Recovers session history after a project directory rename or move.
# Also handles copy detection — assigns a new independent hash without touching the original.

set -euo pipefail

REGISTRY="$HOME/.claude/project-registry.json"
REAL_PWD=$(realpath "$PWD" 2>/dev/null || echo "$PWD")
HASH_FILE="$REAL_PWD/.claude/hash.txt"
FORCE=false
[[ "${1:-}" == "--force" ]] && FORCE=true

# shellcheck source=common.sh
source "$(dirname "${BASH_SOURCE[0]}")/common.sh"

# Normalize to NFC to match registry storage format (see common.sh nfc_normalize)
REAL_PWD=$(nfc_normalize "$REAL_PWD")

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

if [[ -z "$REGISTERED" ]]; then
  echo "preserve-session: hash not found in registry. Re-registering current path..."

  NEW_COLLISION=$(check_slug_collision "$REAL_PWD")
  if [[ -n "$NEW_COLLISION" ]]; then
    echo "preserve-session: warning — slug collision detected"
    while IFS= read -r line; do
      echo "  this path ($REAL_PWD) shares slug with: $line"
    done <<< "$NEW_COLLISION"
    echo "  Sessions from this project will land in the same slug folder as"
    echo "  the sibling above. /cleanup or /move on either project may affect"
    echo "  sessions of both."
    if [[ "$FORCE" == false ]]; then
      echo ""
      echo "  To proceed anyway, run: /preserve-session:fix --force"
      exit 1
    fi
    echo "  Proceeding with --force."
  fi

  registry_write "$HASH" "$REAL_PWD" strict
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

  # Guard: new path may share a slug with a sibling (collision risk)
  NEW_COLLISION=$(check_slug_collision "$REAL_PWD")
  if [[ -n "$NEW_COLLISION" ]]; then
    echo "preserve-session: warning — slug collision detected"
    while IFS= read -r line; do
      echo "  new path ($REAL_PWD) shares slug with: $line"
    done <<< "$NEW_COLLISION"
    echo "  Registering this copy will cause its sessions to land in the same"
    echo "  slug folder as the sibling above. Future /cleanup or /move on"
    echo "  either project may affect sessions of both."
    if [[ "$FORCE" == false ]]; then
      echo ""
      echo "  To proceed anyway, run: /preserve-session:fix --force"
      exit 1
    fi
    echo "  Proceeding with --force."
  fi

  echo "Registering as independent project..."

  NEW_HASH=$(uuidgen_cross)

  # Write registry first — if this fails, hash.txt stays unchanged (no inconsistency)
  registry_write "$NEW_HASH" "$REAL_PWD" strict
  echo "$NEW_HASH" > "$HASH_FILE"

  echo "Done."
  echo "  new hash: $NEW_HASH"
  echo "  path:     $REAL_PWD"
  echo "  original: $REGISTERED (untouched)"
  echo ""
  echo "To bring the original's sessions here:"
  echo "  /preserve-session:copy   (non-destructive — independent copies)"
  echo "  /preserve-session:move   (destructive — empties the original)"

else
  # Old path gone → rename/move case
  echo "preserve-session: detected rename/move"
  echo "  from: $REGISTERED"
  echo "  to:   $REAL_PWD"

  OLD_SLUG=$(path_to_slug "$REGISTERED")
  NEW_SLUG=$(path_to_slug "$REAL_PWD")
  OLD_PROJECTS="$HOME/.claude/projects/$OLD_SLUG"
  NEW_PROJECTS="$HOME/.claude/projects/$NEW_SLUG"

  # Check for slug collisions before renaming/merging
  OLD_COLLISION=$(check_slug_collision "$REGISTERED")
  NEW_COLLISION=$(check_slug_collision "$REAL_PWD")

  if [[ -n "$OLD_COLLISION" || -n "$NEW_COLLISION" ]]; then
    echo "preserve-session: warning — slug collision detected"
    if [[ -n "$OLD_COLLISION" ]]; then
      while IFS= read -r line; do
        echo "  old path ($REGISTERED) shares slug with: $line"
      done <<< "$OLD_COLLISION"
    fi
    if [[ -n "$NEW_COLLISION" ]]; then
      while IFS= read -r line; do
        echo "  new path ($REAL_PWD) shares slug with: $line"
      done <<< "$NEW_COLLISION"
    fi
    echo "  Sessions from these projects share the same folder."
    echo "  Renaming may mix sessions from different projects."
    if [[ "$FORCE" == false ]]; then
      echo ""
      echo "  To proceed anyway, run: /preserve-session:fix --force"
      exit 1
    fi
    echo "  Proceeding with --force."
  fi

  if [[ -d "$OLD_PROJECTS" ]]; then
    if [[ "$OLD_PROJECTS" == "$NEW_PROJECTS" ]]; then
      echo "  (sessions folder slug unchanged — no rename needed)"
    elif [[ -d "$NEW_PROJECTS" ]]; then
      # destination already exists — merge .jsonl files
      COPIED=0
      SKIPPED=0
      for f in "$OLD_PROJECTS"/*.jsonl; do
        [[ -e "$f" ]] || continue
        BASENAME=$(basename "$f")
        DEST="$NEW_PROJECTS/$BASENAME"
        if [[ ! -f "$DEST" ]]; then
          cp "$f" "$DEST"
          (( COPIED++ )) || true
        else
          (( SKIPPED++ )) || true
        fi
      done
      echo "  sessions merged: $COPIED copied, $SKIPPED skipped (already existed)"
      echo "  old folder kept as stale: $OLD_PROJECTS"
      echo "  (run /preserve-session:cleanup to remove stale folders)"
    else
      mv "$OLD_PROJECTS" "$NEW_PROJECTS"
      echo "  sessions folder renamed: $OLD_SLUG → $NEW_SLUG"
    fi
  else
    echo "  (no sessions folder found — nothing to rename)"
  fi

  registry_write "$HASH" "$REAL_PWD" strict

  echo "Done. Session history recovered."
  echo "You can now use 'claude --resume' or 'claude --continue'."
fi
