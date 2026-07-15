#!/usr/bin/env bash
# check-status.sh <orch-dir>
# Outputs a markdown dashboard of the current orchestration state.

SCRIPT_DIR="$(cd "$(dirname "$0")" && pwd)"
source "$SCRIPT_DIR/orchestration-state.sh"

ORCH_DIR="$1"
[ -z "$ORCH_DIR" ] && ORCH_DIR=$(find_active_orch)
[ -z "$ORCH_DIR" ] && { echo "No active orchestration"; exit 1; }

node "$JSON_TOOL" dashboard "$ORCH_DIR/state.json"
