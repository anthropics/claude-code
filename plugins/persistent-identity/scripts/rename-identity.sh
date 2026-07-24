#!/usr/bin/env bash
set -euo pipefail

IDENTITY_DIR="$HOME/.claude/persistent-identity"
IDENTITY_FILE="$IDENTITY_DIR/identity.md"

# --- No argument: show current name ---
if [[ $# -eq 0 ]] || [[ -z "${1:-}" ]]; then
  if [[ -f "$IDENTITY_FILE" ]]; then
    CURRENT_NAME=$(head -1 "$IDENTITY_FILE" | sed 's/^# //')
    echo "Current identity: ${CURRENT_NAME}"
    echo ""
    echo "To rename, use: /name <new-name>"
    echo "Example: /name swift-fox"
  else
    echo "No identity set yet. Start a new session to auto-generate one,"
    echo "or use: /name <new-name>"
  fi
  exit 0
fi

NEW_NAME="$1"

# --- Validate name format ---
if [[ ! "$NEW_NAME" =~ ^[a-zA-Z][a-zA-Z0-9-]*[a-zA-Z0-9]$ ]] || [[ ${#NEW_NAME} -lt 2 ]] || [[ ${#NEW_NAME} -gt 30 ]]; then
  echo "Error: Invalid name '${NEW_NAME}'" >&2
  echo "" >&2
  echo "Name requirements:" >&2
  echo "  - 2-30 characters" >&2
  echo "  - Letters, numbers, and hyphens only" >&2
  echo "  - Must start with a letter" >&2
  echo "  - Must not end with a hyphen" >&2
  exit 1
fi

# --- Read old name ---
OLD_NAME=""
if [[ -f "$IDENTITY_FILE" ]]; then
  OLD_NAME=$(head -1 "$IDENTITY_FILE" | sed 's/^# //')
fi

# --- Update identity file ---
mkdir -p "$IDENTITY_DIR"

cat > "$IDENTITY_FILE" << EOF
# ${NEW_NAME}

Created: $(date -u +%Y-%m-%dT%H:%M:%SZ)
Renamed from: ${OLD_NAME:-"(first name)"}

This is the persistent identity for this Claude Code installation.
Use /name to change your name.
EOF

# --- Report ---
if [[ -n "$OLD_NAME" ]]; then
  echo "Renamed from '${OLD_NAME}' to '${NEW_NAME}'"
else
  echo "Identity set to '${NEW_NAME}'"
fi
echo ""
echo "The new name will appear in your greeting on the next session."
