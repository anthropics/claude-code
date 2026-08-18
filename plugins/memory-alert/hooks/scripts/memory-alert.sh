#!/bin/bash
# Memory alert for Claude Code
# Alerts when Claude Code process memory exceeds a configurable threshold
#
# Configuration (environment variables):
#   MEMORY_ALERT_THRESHOLD_GB  - threshold in GB (default: 5)

THRESHOLD_GB="${MEMORY_ALERT_THRESHOLD_GB:-5}"
THRESHOLD_MB=$(awk "BEGIN { printf \"%d\", $THRESHOLD_GB * 1024 }")

OS="$(uname -s)"

get_claude_memory_mb() {
  case "$OS" in
    Darwin)
      # Sum RSS (in KB) of all Claude CLI processes, convert to MB
      ps -eo rss,command 2>/dev/null \
        | awk '/^[[:space:]]*[0-9]+[[:space:]]+claude/ { sum += $1 } END { printf "%d", sum / 1024 }'
      ;;
    Linux)
      # Sum RSS (in KB) from /proc for claude processes, convert to MB
      ps -eo rss,command 2>/dev/null \
        | awk '/^[[:space:]]*[0-9]+[[:space:]]+.*claude/ { sum += $1 } END { printf "%d", sum / 1024 }'
      ;;
    *)
      echo "0"
      return 1
      ;;
  esac
}

used_mb=$(get_claude_memory_mb) || exit 0

if [ "$used_mb" -gt "$THRESHOLD_MB" ] 2>/dev/null; then
  used_gb=$(awk "BEGIN { printf \"%.1f\", $used_mb / 1024 }")
  echo "[MEMORY ALERT] Claude Code memory usage: ${used_gb}GB (threshold: ${THRESHOLD_GB}GB) — consider closing idle sessions" >&2
fi

exit 0
