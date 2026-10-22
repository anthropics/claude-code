#!/bin/bash
# Claude Code PreToolUse hook — rate limiter + team telemetry via Mutex daemon
# Blocks until the Mutex daemon releases this caller.
# Forwards tool call metadata so the team leader can monitor all windows.
# Install: add to ~/.claude/settings.json PreToolUse hooks
#
# Env vars:
#   MUTEX_TEAM  — team identifier (e.g. "A", "B", "Leader"). Default: "unknown"
#   MUTEX_PORT  — daemon port. Default: 9876
#
# If daemon is not running, allow immediately (fail-open).

PORT="${MUTEX_PORT:-9876}"
TEAM="${MUTEX_TEAM:-unknown}"

# Claude Code sends hook input JSON on stdin — capture it for the daemon.
# The JSON contains tool_name, tool_input, session_id, etc.
PAYLOAD=$(cat)

# POST the payload with team header — daemon logs it and streams via SSE.
# Falls back to GET /acquire if POST fails (backwards compat with v1 daemon).
curl -sf --max-time 30 -X POST \
  -H "X-Team: $TEAM" \
  -H "Content-Type: application/json" \
  -d "$PAYLOAD" \
  "http://localhost:$PORT/acquire" > /dev/null 2>&1 \
|| curl -sf --max-time 30 "http://localhost:$PORT/acquire" > /dev/null 2>&1

# Always allow — fail-open if daemon unreachable
exit 0
