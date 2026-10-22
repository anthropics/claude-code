#!/usr/bin/env bash

set -euo pipefail

SCRIPT_DIR="$(cd -- "$(dirname -- "$0")" && pwd)"
CONFIG_FILE="${SCRIPT_DIR}/config.env"

if [ -f "$CONFIG_FILE" ]; then
  # shellcheck disable=SC1090
  source "$CONFIG_FILE"
fi

CACHE_FILE="${CLAUDE_USAGE_MONITOR_CACHE_FILE:-${SCRIPT_DIR}/cache.json}"
LOCK_FILE="${CLAUDE_USAGE_MONITOR_LOCK_FILE:-${SCRIPT_DIR}/fetch.lock}"
FETCHER="${SCRIPT_DIR}/claude-usage-fetch.sh"
REFRESH_MINUTES="${CLAUDE_USAGE_MONITOR_REFRESH_MINUTES:-5}"

refresh_now() {
  "$FETCHER" >/dev/null 2>&1 &
}

if [ "${1:-}" = "refresh_now" ]; then
  refresh_now
  exit 0
fi

session_pct="?"
week_all_pct="?"
week_sonnet_pct="?"
session_reset="?"
week_all_reset="?"
week_sonnet_reset="?"
updated="never"

if [ -f "$CACHE_FILE" ] && command -v jq >/dev/null 2>&1; then
  session_pct="$(jq -r '.session // "?"' "$CACHE_FILE" 2>/dev/null || printf '?\n')"
  week_all_pct="$(jq -r '.week_all // "?"' "$CACHE_FILE" 2>/dev/null || printf '?\n')"
  week_sonnet_pct="$(jq -r '.week_sonnet // "?"' "$CACHE_FILE" 2>/dev/null || printf '?\n')"
  session_reset="$(jq -r '.session_reset // "?"' "$CACHE_FILE" 2>/dev/null || printf '?\n')"
  week_all_reset="$(jq -r '.week_all_reset // "?"' "$CACHE_FILE" 2>/dev/null || printf '?\n')"
  week_sonnet_reset="$(jq -r '.week_sonnet_reset // "?"' "$CACHE_FILE" 2>/dev/null || printf '?\n')"
  updated="$(jq -r '.updated // "never"' "$CACHE_FILE" 2>/dev/null || printf 'never\n')"
fi

max_pct=0
for value in "$session_pct" "$week_all_pct" "$week_sonnet_pct"; do
  if [[ "$value" =~ ^[0-9]+$ ]] && [ "$value" -gt "$max_pct" ]; then
    max_pct="$value"
  fi
done

icon="🟢"
if [ "$max_pct" -ge 80 ]; then
  icon="🔴"
elif [ "$max_pct" -ge 50 ]; then
  icon="🟡"
fi

title="${session_pct}%(${session_reset})┊${week_all_pct}%(${week_all_reset})┊${week_sonnet_pct}%(${week_sonnet_reset})"

if [ "$session_pct" = "?" ]; then
  echo "☁️ --% | color=#888888"
else
  echo "${icon} ${title} | color=white"
fi

echo "---"
echo "Claude Code Usage | size=14"
echo "---"
echo "Session:       ${session_pct}% (reset ${session_reset})"
echo "Week (all):    ${week_all_pct}% (reset ${week_all_reset})"
echo "Week (sonnet): ${week_sonnet_pct}% (reset ${week_sonnet_reset})"
echo "---"
echo "Updated: ${updated} | size=11 color=#888888"
echo "Refresh now | bash='${SCRIPT_DIR}/claude-usage.1m.sh' param1=refresh_now terminal=false refresh=true"

if [ -f "$CACHE_FILE" ]; then
  cache_age=$(( $(date +%s) - $(stat -f%m "$CACHE_FILE") ))
  refresh_window=$(( REFRESH_MINUTES * 60 ))
  if [ "$cache_age" -ge "$refresh_window" ] && [ ! -f "$LOCK_FILE" ]; then
    refresh_now
  fi
else
  refresh_now
fi
