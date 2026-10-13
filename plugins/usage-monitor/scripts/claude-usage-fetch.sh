#!/usr/bin/env bash

set -euo pipefail

SCRIPT_DIR="$(cd -- "$(dirname -- "$0")" && pwd)"
CONFIG_FILE="${SCRIPT_DIR}/config.env"

if [ -f "$CONFIG_FILE" ]; then
  # shellcheck disable=SC1090
  source "$CONFIG_FILE"
fi

TRUSTED_DIR="${CLAUDE_USAGE_MONITOR_TRUSTED_DIR:-$HOME}"
CACHE_FILE="${CLAUDE_USAGE_MONITOR_CACHE_FILE:-${SCRIPT_DIR}/cache.json}"
SESSION_FILE="${CLAUDE_USAGE_MONITOR_SESSION_FILE:-${SCRIPT_DIR}/session.txt}"
LOCK_FILE="${CLAUDE_USAGE_MONITOR_LOCK_FILE:-${SCRIPT_DIR}/fetch.lock}"
CLAUDE_BIN="${CLAUDE_USAGE_MONITOR_CLAUDE_BIN:-$(command -v claude || true)}"

if [ "$(uname -s)" != "Darwin" ]; then
  exit 0
fi

if [ -z "$CLAUDE_BIN" ] || [ ! -x "$CLAUDE_BIN" ]; then
  exit 0
fi

mkdir -p "$SCRIPT_DIR"

if [ -f "$LOCK_FILE" ]; then
  lock_age=$(( $(date +%s) - $(stat -f%m "$LOCK_FILE") ))
  if [ "$lock_age" -lt 60 ]; then
    exit 0
  fi
fi

printf '%s\n' "$$" >"$LOCK_FILE"
trap 'rm -f "$LOCK_FILE"' EXIT

cd "$TRUSTED_DIR"

{
  sleep 4
  printf "\r"
  sleep 8
  printf "/usage\r"
  sleep 8
  printf "\033"
  sleep 2
  printf "/exit\r"
  sleep 2
} | TERM=dumb script -q "$SESSION_FILE" "$CLAUDE_BIN" \
  --no-chrome \
  --disallowedTools "Bash,Edit,Write,Read,Grep,Glob,Agent" \
  2>/dev/null

cleaned_output="$(perl -pe '
  s/\e\[\d*C/ /g;
  s/\e\[\?[^a-zA-Z]*[a-zA-Z]//g;
  s/\e\[[^a-zA-Z]*[a-zA-Z]//g;
  s/\e\][^\a]*(\a|\e\\)//g;
  s/\e\([A-Z]//g;
  s/\e[=>]//g;
  s/[\x00-\x08\x0b\x0c\x0e-\x1f]//g;
  s/\s+/ /g;
' "$SESSION_FILE" 2>/dev/null || true)"

extract_percentages() {
  printf '%s\n' "$cleaned_output" | grep -oE '[0-9]+%[[:space:]]*used' | sed 's/% *used//' | head -3
}

extract_resets() {
  printf '%s\n' "$cleaned_output" | perl -ne '
    while (/Rese[\w\s]*?\s+((?:[A-Z][a-z]{2}\s+\d+[,.]?\s+)?\d+(?::\d+)?\s*[ap]?\s*m)\b/gi) {
      print "$1\n";
    }
  ' | head -3
}

calc_remaining() {
  local raw="$1"
  [ -z "$raw" ] && printf '?\n' && return

  local month
  local day
  month="$(printf '%s\n' "$raw" | perl -ne 'print $1 if /^([A-Z][a-z]{2})/i')"
  day="$(printf '%s\n' "$raw" | perl -ne 'print $1 if /^[A-Za-z]{3}\s*(\d+)/')"

  if [ -n "$month" ] && [ -n "$day" ]; then
    month="$(printf '%s\n' "$month" | perl -pe '$_ = ucfirst(lc($_))')"
    local target_epoch
    local today_midnight
    target_epoch="$(date -j -f "%b %d %Y %H%M" "$month $day $(date +%Y) 0000" +%s 2>/dev/null || true)"
    today_midnight="$(date -j -f "%Y%m%d %H%M" "$(date +%Y%m%d) 0000" +%s 2>/dev/null || true)"
    if [ -n "$target_epoch" ] && [ -n "$today_midnight" ]; then
      local days
      days=$(( (target_epoch - today_midnight) / 86400 ))
      if [ "$days" -le 0 ]; then
        printf 'today\n'
      else
        printf '%sd\n' "$days"
      fi
      return
    fi
  fi

  local time_label
  time_label="$(printf '%s\n' "$raw" | grep -oiE '[0-9]+(:[0-9]+)?\s*[ap]?\s*m' || true)"
  if [ -n "$time_label" ]; then
    time_label="$(printf '%s\n' "$time_label" | perl -pe 's/\s+//g')"
    time_label="$(printf '%s\n' "$time_label" | perl -pe 'if (/^(\d+)(:\d+)?m$/i) { my $h=$1; $h<=6 ? s/m$/am/i : s/m$/pm/i }')"
    printf '%s\n' "$time_label"
    return
  fi

  printf '?\n'
}

percentages="$(extract_percentages)"
resets="$(extract_resets)"

session_pct="$(printf '%s\n' "$percentages" | sed -n '1p')"
week_all_pct="$(printf '%s\n' "$percentages" | sed -n '2p')"
week_sonnet_pct="$(printf '%s\n' "$percentages" | sed -n '3p')"

if ! [[ "${session_pct:-}" =~ ^[0-9]+$ ]]; then
  exit 0
fi

session_reset="$(calc_remaining "$(printf '%s\n' "$resets" | sed -n '1p')")"
week_all_reset="$(calc_remaining "$(printf '%s\n' "$resets" | sed -n '2p')")"
week_sonnet_reset="$(calc_remaining "$(printf '%s\n' "$resets" | sed -n '3p')")"

cat >"$CACHE_FILE" <<JSON
{
  "session": "${session_pct}",
  "week_all": "${week_all_pct:-?}",
  "week_sonnet": "${week_sonnet_pct:-?}",
  "session_reset": "${session_reset:-?}",
  "week_all_reset": "${week_all_reset:-?}",
  "week_sonnet_reset": "${week_sonnet_reset:-?}",
  "updated": "$(date '+%H:%M')"
}
JSON
