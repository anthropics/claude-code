#!/usr/bin/env bash
# spawn-agents.sh <orch-dir> <wave-index>
# Creates wmux panes and spawns Claude Code agents for a wave.

SCRIPT_DIR="$(cd "$(dirname "$0")" && pwd)"
source "$SCRIPT_DIR/orchestration-state.sh"

ORCH_DIR="$1"
WAVE_IDX="$2"

[ -z "$ORCH_DIR" ] || [ -z "$WAVE_IDX" ] && { echo "Usage: spawn-agents.sh <orch-dir> <wave-index>"; exit 1; }

WMUX_AVAILABLE=false
if command -v wmux &>/dev/null && wmux ping 2>/dev/null | grep -q pong; then
  WMUX_AVAILABLE=true
fi

if [ "$WMUX_AVAILABLE" = "true" ]; then
  PANE_IDX=0
  node "$JSON_TOOL" query "$ORCH_DIR/state.json" wave-agents-each "$WAVE_IDX" | while IFS= read -r agent; do
    [ -z "$agent" ] && continue
    AGENT_ID=$(parse_json "$agent" '.id')
    AGENT_LABEL=$(parse_json "$agent" '.label')
    PROMPT_FILE="$ORCH_DIR/agent-${AGENT_ID}-prompt.md"

    if [ $PANE_IDX -eq 0 ]; then
      RESULT=$(wmux split --right --type terminal 2>/dev/null)
    else
      RESULT=$(wmux split --down --type terminal 2>/dev/null)
    fi

    PANE_ID=$(parse_json "$RESULT" '.paneId')

    CWD=$(read_state "$ORCH_DIR" '.cwd')
    [ -z "$CWD" ] || [ "$CWD" = "null" ] && CWD="$(pwd)"

    SPAWN_RESULT=$(wmux agent spawn \
      --cmd "claude --prompt-file \"$PROMPT_FILE\"" \
      --label "$AGENT_LABEL" \
      --cwd "$CWD" \
      --pane "$PANE_ID" 2>/dev/null)

    SPAWNED_SURFACE_ID=$(parse_json "$SPAWN_RESULT" '.surfaceId')

    NOW=$(date -u +%Y-%m-%dT%H:%M:%SZ)
    update_agent "$ORCH_DIR" "$AGENT_ID" \
      "paneId=$PANE_ID" \
      "surfaceId=$SPAWNED_SURFACE_ID" \
      "status=running" \
      "startedAt=$NOW"

    PANE_IDX=$((PANE_IDX + 1))
  done
else
  node "$JSON_TOOL" query "$ORCH_DIR/state.json" wave-agents "$WAVE_IDX" > "$ORCH_DIR/wave-${WAVE_IDX}-pending-spawn.json"
fi
