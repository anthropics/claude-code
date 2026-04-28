#!/usr/bin/env bash
# update-dashboard.sh <orch-dir>
# Regenerates dashboard and pushes to wmux markdown pane.

SCRIPT_DIR="$(cd "$(dirname "$0")" && pwd)"
source "$SCRIPT_DIR/orchestration-state.sh"

ORCH_DIR="$1"
[ -z "$ORCH_DIR" ] && ORCH_DIR=$(find_active_orch)
[ -z "$ORCH_DIR" ] && exit 0

bash "$SCRIPT_DIR/check-status.sh" "$ORCH_DIR" > "$ORCH_DIR/dashboard.md"

DASHBOARD_SID=$(read_state "$ORCH_DIR" '.dashboardSurfaceId')
if [ "$DASHBOARD_SID" != "null" ] && [ -n "$DASHBOARD_SID" ] && command -v wmux &>/dev/null; then
  wmux markdown set "$DASHBOARD_SID" --file "$ORCH_DIR/dashboard.md" 2>/dev/null || true
fi
