#!/usr/bin/env bash
# collect-results.sh <orch-dir>
# Aggregates all agent result files into a single summary for the reviewer.

SCRIPT_DIR="$(cd "$(dirname "$0")" && pwd)"
source "$SCRIPT_DIR/orchestration-state.sh"

ORCH_DIR="$1"
[ -z "$ORCH_DIR" ] && { echo "Usage: collect-results.sh <orch-dir>"; exit 1; }

echo "# Orchestration Results Summary"
echo ""

WAVE_COUNT=$(node "$JSON_TOOL" query "$ORCH_DIR/state.json" wave-count 2>/dev/null)

for i in $(seq 0 $((WAVE_COUNT - 1))); do
  echo "## Wave $((i + 1))"
  echo ""

  node "$JSON_TOOL" query "$ORCH_DIR/state.json" wave-agent-ids "$i" | while IFS= read -r agent_id; do
    [ -z "$agent_id" ] && continue
    LABEL=$(node "$JSON_TOOL" query "$ORCH_DIR/state.json" agent-label "$agent_id" 2>/dev/null)
    RESULT_FILE="$ORCH_DIR/agent-${agent_id}-result.md"

    echo "### $LABEL"
    echo ""
    if [ -f "$RESULT_FILE" ]; then
      cat "$RESULT_FILE"
    else
      echo "_No result file found._"
    fi
    echo ""
  done
done
