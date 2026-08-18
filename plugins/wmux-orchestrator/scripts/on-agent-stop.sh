#!/usr/bin/env bash
# SubagentStop hook: update agent status, check wave completion, trigger next wave.
# This is the core orchestration driver. Must complete in <15s.

SCRIPT_DIR="$(cd "$(dirname "$0")" && pwd)"
source "$SCRIPT_DIR/orchestration-state.sh"

ORCH_DIR=$(find_active_orch)
[ -z "$ORCH_DIR" ] && exit 0

AGENT_ID="${WMUX_AGENT_ID:-}"
[ -z "$AGENT_ID" ] && exit 0

EXIT_CODE="${CLAUDE_EXIT_CODE:-0}"
NOW=$(date -u +%Y-%m-%dT%H:%M:%SZ)

if [ "$EXIT_CODE" = "0" ]; then
  update_agent "$ORCH_DIR" "$AGENT_ID" "status=completed" "exitCode=0" "finishedAt=$NOW"
else
  update_agent "$ORCH_DIR" "$AGENT_ID" "status=failed" "exitCode=$EXIT_CODE" "finishedAt=$NOW"
fi

WAVE_IDX=$(node "$JSON_TOOL" query "$ORCH_DIR/state.json" wave-of-agent "$AGENT_ID" 2>/dev/null)

if [ -n "$WAVE_IDX" ] && wave_complete "$ORCH_DIR" "$WAVE_IDX"; then
  update_state "$ORCH_DIR" ".waves[$WAVE_IDX].status" "completed"

  if all_waves_done "$ORCH_DIR"; then
    REVIEWER_STATUS=$(read_state "$ORCH_DIR" '.reviewer.status')
    if [ "$REVIEWER_STATUS" = "pending" ]; then
      update_state "$ORCH_DIR" '.reviewer.status' 'ready'
      if command -v wmux &>/dev/null; then
        wmux notify "All agents complete. Starting reviewer..." 2>/dev/null || true
      fi
    else
      update_state "$ORCH_DIR" '.status' 'completed'
    fi
  else
    NEXT_WAVE=$(next_pending_wave "$ORCH_DIR")
    if [ -n "$NEXT_WAVE" ]; then
      update_state "$ORCH_DIR" ".waves[$NEXT_WAVE].status" "running"
      bash "$SCRIPT_DIR/spawn-agents.sh" "$ORCH_DIR" "$NEXT_WAVE"
    fi
  fi
fi

if command -v wmux &>/dev/null; then
  DASHBOARD_SID=$(read_state "$ORCH_DIR" '.dashboardSurfaceId')
  if [ "$DASHBOARD_SID" != "null" ] && [ -n "$DASHBOARD_SID" ]; then
    bash "$SCRIPT_DIR/check-status.sh" "$ORCH_DIR" > "$ORCH_DIR/dashboard.md"
    wmux markdown set "$DASHBOARD_SID" --file "$ORCH_DIR/dashboard.md" 2>/dev/null || true
  fi
fi
