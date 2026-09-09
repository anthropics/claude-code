#!/usr/bin/env bash

set -uo pipefail

decision_emitted=0

emit_approve() {
  if [ "$decision_emitted" -eq 0 ]; then
    decision_emitted=1
    printf '%s\n' '{"decision":"approve"}'
  fi
}

trap emit_approve EXIT

# Consume hook input so Claude Code can pipe structured Stop event JSON to us
# without leaving stdin unread. The current implementation only needs env-based
# configuration, so the payload is intentionally ignored after reading.
cat >/dev/null 2>&1 || true

is_enabled() {
  case "${1:-}" in
    "" | 0 | false | FALSE | no | NO | off | OFF)
      return 1
      ;;
    *)
      return 0
      ;;
  esac
}

find_system_sound_file() {
  local sound_name="$1"
  local candidate
  for candidate in \
    "/System/Library/Sounds/${sound_name}.aiff" \
    "/System/Library/Sounds/${sound_name}.caf" \
    "/System/Library/Sounds/${sound_name}.wav"
  do
    if [ -f "$candidate" ]; then
      printf '%s\n' "$candidate"
      return 0
    fi
  done
  return 1
}

run_detached() {
  ( "$@" >/dev/null 2>&1 & )
}

desktop_enabled="${NOTIFY_DESKTOP:-1}"
sound_enabled="${NOTIFY_SOUND:-1}"
say_enabled="${NOTIFY_SAY:-0}"
title="${NOTIFY_TITLE:-Claude Code}"
message="${NOTIFY_MESSAGE:-Task complete}"
say_text="${NOTIFY_SAY_TEXT:-$message}"
voice="${NOTIFY_VOICE:-}"
sound_name="${NOTIFY_SOUND_NAME:-Hero}"
sound_file="${NOTIFY_SOUND_FILE:-}"

case "$(uname -s)" in
  Darwin)
    if is_enabled "$desktop_enabled" && command -v osascript >/dev/null 2>&1; then
      run_detached osascript - "$title" "$message" <<'APPLESCRIPT'
on run argv
  set notificationTitle to item 1 of argv
  set notificationMessage to item 2 of argv
  display notification notificationMessage with title notificationTitle
end run
APPLESCRIPT
    fi

    if is_enabled "$sound_enabled" && command -v afplay >/dev/null 2>&1; then
      if [ -n "$sound_file" ] && [ -f "$sound_file" ]; then
        run_detached afplay "$sound_file"
      else
        resolved_sound_file="$(find_system_sound_file "$sound_name" || true)"
        if [ -n "$resolved_sound_file" ]; then
          run_detached afplay "$resolved_sound_file"
        fi
      fi
    fi

    if is_enabled "$say_enabled" && command -v say >/dev/null 2>&1; then
      if [ -n "$voice" ]; then
        run_detached say -v "$voice" "$say_text"
      else
        run_detached say "$say_text"
      fi
    fi
    ;;
  Linux)
    if is_enabled "$desktop_enabled" && command -v notify-send >/dev/null 2>&1; then
      run_detached notify-send "$title" "$message"
    fi

    if is_enabled "$sound_enabled" && [ -n "$sound_file" ] && [ -f "$sound_file" ]; then
      if command -v paplay >/dev/null 2>&1; then
        run_detached paplay "$sound_file"
      elif command -v pw-play >/dev/null 2>&1; then
        run_detached pw-play "$sound_file"
      elif command -v aplay >/dev/null 2>&1; then
        run_detached aplay "$sound_file"
      fi
    fi

    if is_enabled "$say_enabled" && command -v espeak >/dev/null 2>&1; then
      if [ -n "$voice" ]; then
        run_detached espeak -v "$voice" "$say_text"
      else
        run_detached espeak "$say_text"
      fi
    fi
    ;;
esac
