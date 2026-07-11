#!/bin/bash

set -euo pipefail
umask 077

SCRIPT_DIR=$(cd -- "$(dirname -- "${BASH_SOURCE[0]}")" && pwd)
# shellcheck source=ralph-state.sh
source "$SCRIPT_DIR/ralph-state.sh"

SESSION_ID="${CLAUDE_CODE_SESSION_ID:-}"

if [[ "${1:-}" = "--session-id" ]]; then
  [[ -n "${2:-}" ]] || { echo "Error: --session-id requires an argument" >&2; exit 1; }
  SESSION_ID="$2"
  shift 2
fi

[[ $# -eq 0 ]] || { echo "Error: unexpected arguments" >&2; exit 1; }
[[ "$SESSION_ID" =~ ^[A-Za-z0-9][A-Za-z0-9._-]{0,127}$ ]] || {
  echo "Error: missing or invalid session ID" >&2
  exit 1
}

ralph_resolve_state_path "$SESSION_ID" || {
  echo "Error: $RALPH_STATE_ERROR" >&2
  exit 1
}
STATE_ROOT="$RALPH_STATE_ROOT"
STATE_DIR="$RALPH_STATE_DIR"
STATE_FILE="$RALPH_STATE_FILE"

if [[ -L "$STATE_ROOT" ]] || { [[ -e "$STATE_ROOT" ]] && \
  { [[ ! -d "$STATE_ROOT" ]] || [[ ! -O "$STATE_ROOT" ]]; }; }; then
  echo "Error: refusing an unsafe private Ralph state path" >&2
  exit 1
fi

if [[ ! -e "$STATE_DIR" && ! -L "$STATE_DIR" ]]; then
  echo "No active Ralph loop found for this session."
  exit 0
fi

if [[ ! -d "$STATE_ROOT" || ! -O "$STATE_ROOT" || -L "$STATE_ROOT" || \
  -L "$STATE_DIR" || \
  ! -d "$STATE_DIR" || ! -O "$STATE_DIR" || -L "$STATE_FILE" ]]; then
  echo "Error: refusing an unsafe private Ralph state path" >&2
  exit 1
fi

if ! ralph_acquire_state_lock "$SESSION_ID"; then
  echo "Error: $RALPH_STATE_ERROR" >&2
  exit 1
fi
trap ralph_release_state_lock EXIT

if [[ ! -e "$STATE_FILE" ]]; then
  echo "No active Ralph loop found for this session."
  exit 0
fi

[[ -f "$STATE_FILE" && -O "$STATE_FILE" ]] || {
  echo "Error: Ralph state is not a user-owned regular file" >&2
  exit 1
}
ITERATION=$(sed -n 's/^iteration:[[:space:]]*//p' "$STATE_FILE" | head -n 1)
rm -- "$STATE_FILE"
echo "Cancelled Ralph loop for this session (was at iteration ${ITERATION:-unknown})."
