#!/usr/bin/env bash
# Stop hook: warn if orchestration is active before Claude Code exits.

SCRIPT_DIR="$(cd "$(dirname "$0")" && pwd)"
source "$SCRIPT_DIR/orchestration-state.sh"

ORCH_DIR=$(find_active_orch)
[ -z "$ORCH_DIR" ] && exit 0

RUNNING=$(node "$JSON_TOOL" query "$ORCH_DIR/state.json" count-agents-by-status running 2>/dev/null)

if [ "$RUNNING" -gt 0 ] 2>/dev/null; then
  echo "WARNING: wmux orchestration in progress with $RUNNING active agent(s)."
  echo "Exiting now will leave agents running unmonitored."
fi
