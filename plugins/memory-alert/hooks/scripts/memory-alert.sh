#!/bin/bash
# Memory alert for Claude Code
# Alerts when system memory usage exceeds threshold
#
# Configuration (environment variables):
#   MEMORY_ALERT_THRESHOLD_GB  - threshold in GB (default: 5)

THRESHOLD_GB="${MEMORY_ALERT_THRESHOLD_GB:-5}"

OS="$(uname -s)"

get_memory_used_gb() {
  case "$OS" in
    Darwin)
      local pagesize
      pagesize=$(sysctl -n hw.pagesize 2>/dev/null) || return 1

      local active=0 wired=0 compressed=0
      while IFS= read -r line; do
        case "$line" in
          *"Pages active"*)     active=$(echo "$line" | awk '{gsub(/\./,"",$3); print $3}') ;;
          *"Pages wired"*)      wired=$(echo "$line" | awk '{gsub(/\./,"",$4); print $4}') ;;
          *"Pages compressed"*) compressed=$(echo "$line" | awk '{gsub(/\./,"",$5); print $5}') ;;
        esac
      done < <(vm_stat 2>/dev/null)

      awk "BEGIN { printf \"%.1f\", ($active + $wired + ${compressed:-0}) * $pagesize / 1024 / 1024 / 1024 }"
      ;;
    Linux)
      awk '/MemTotal/{t=$2} /MemAvailable/{a=$2} END { printf "%.1f", (t-a)/1024/1024 }' /proc/meminfo 2>/dev/null || return 1
      ;;
    *)
      return 1
      ;;
  esac
}

get_total_memory_gb() {
  case "$OS" in
    Darwin)
      sysctl -n hw.memsize 2>/dev/null | awk '{ printf "%.0f", $1/1024/1024/1024 }'
      ;;
    Linux)
      awk '/MemTotal/ { printf "%.0f", $2/1024/1024 }' /proc/meminfo 2>/dev/null
      ;;
  esac
}

used_gb=$(get_memory_used_gb) || exit 0
total_gb=$(get_total_memory_gb)

exceeds=$(awk "BEGIN { print ($used_gb > $THRESHOLD_GB) ? 1 : 0 }")

if [ "$exceeds" -eq 1 ]; then
  echo "[MEMORY ALERT] System memory usage: ${used_gb}GB / ${total_gb}GB (threshold: ${THRESHOLD_GB}GB)" >&2
fi

exit 0
