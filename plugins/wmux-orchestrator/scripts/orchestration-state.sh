#!/usr/bin/env bash
# orchestration-state.sh — State management library for wmux orchestrations.
# Source this file in other scripts: source "${CLAUDE_PLUGIN_ROOT}/scripts/orchestration-state.sh"
#
# Uses json-tool.js (Node.js) instead of jq for Windows compatibility.
# Node.js is always available because Claude Code runs on it.

ORCH_BASE="${TMPDIR:-/tmp}"
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
JSON_TOOL="$SCRIPT_DIR/json-tool.js"

# Find the active orchestration directory (most recent state.json with status "running")
find_active_orch() {
  local latest=""
  local latest_time=0
  for dir in "$ORCH_BASE"/wmux-orch-*/; do
    [ -d "$dir" ] || continue
    local state="$dir/state.json"
    [ -f "$state" ] || continue
    local status
    status=$(node "$JSON_TOOL" get "$state" .status 2>/dev/null)
    if [ "$status" = "running" ]; then
      local mtime
      mtime=$(stat -c %Y "$state" 2>/dev/null || stat -f %m "$state" 2>/dev/null || echo 0)
      if [ "$mtime" -gt "$latest_time" ]; then
        latest="$dir"
        latest_time="$mtime"
      fi
    fi
  done
  echo "$latest"
}

# Get orchestration dir by ID
get_orch_dir() {
  local id="$1"
  echo "$ORCH_BASE/wmux-orch-$id"
}

# Create a new orchestration directory
create_orch_dir() {
  local id="$1"
  local dir="$ORCH_BASE/wmux-orch-$id"
  mkdir -p "$dir"
  echo "$dir"
}

# Acquire lock (simple file-based, 2s timeout)
acquire_lock() {
  local dir="$1"
  local lockfile="$dir/state.lock"
  local timeout=20  # 20 * 100ms = 2s
  local i=0
  while [ -f "$lockfile" ] && [ $i -lt $timeout ]; do
    sleep 0.1
    i=$((i + 1))
  done
  echo $$ > "$lockfile"
}

# Release lock
release_lock() {
  local dir="$1"
  rm -f "$dir/state.lock"
}

# Read state JSON field
read_state() {
  local dir="$1"
  local query="$2"
  node "$JSON_TOOL" get "$dir/state.json" "$query" 2>/dev/null
}

# Update state JSON — sets a single field at a dot path
# Usage: update_state <dir> <dotPath> <value>
# json-tool.js writes in-place, so no temp file / race condition.
update_state() {
  local dir="$1"
  local path="$2"
  local value="$3"
  acquire_lock "$dir"
  node "$JSON_TOOL" set "$dir/state.json" "$path" "$value"
  release_lock "$dir"
}

# Increment a numeric field
# Usage: inc_state <dir> <dotPath>
inc_state() {
  local dir="$1"
  local path="$2"
  acquire_lock "$dir"
  node "$JSON_TOOL" inc "$dir/state.json" "$path"
  release_lock "$dir"
}

# Update multiple fields on an agent at once
# Usage: update_agent <dir> <agentId> <field=value>...
update_agent() {
  local dir="$1"
  local agent_id="$2"
  shift 2
  acquire_lock "$dir"
  node "$JSON_TOOL" update-agent "$dir/state.json" "$agent_id" "$@"
  release_lock "$dir"
}

# Check if all agents in a wave are completed
wave_complete() {
  local dir="$1"
  local wave_idx="$2"
  local result
  result=$(node "$JSON_TOOL" query "$dir/state.json" wave-complete "$wave_idx" 2>/dev/null)
  [ "$result" = "true" ]
}

# Get the next pending wave index
next_pending_wave() {
  local dir="$1"
  node "$JSON_TOOL" query "$dir/state.json" next-pending-wave 2>/dev/null
}

# Check if all waves are done
all_waves_done() {
  local dir="$1"
  local result
  result=$(node "$JSON_TOOL" query "$dir/state.json" all-waves-done 2>/dev/null)
  [ "$result" = "true" ]
}

# Parse a JSON string and extract a field (replaces: echo "$json" | jq -r '.field')
# Usage: parse_json "$json_string" ".field"
parse_json() {
  local json_str="$1"
  local path="$2"
  node "$JSON_TOOL" parse-json "$json_str" "$path" 2>/dev/null
}
