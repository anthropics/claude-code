#!/usr/bin/env bash
#
# Claude Code Stop hook — configurable completion notification
#
# Features (toggle via env vars):
#   NOTIFY_SOUND=1   — play a sound (default: on)
#   NOTIFY_DESKTOP=1 — show desktop notification (default: on)
#   NOTIFY_SAY=0     — speak a message aloud (default: off)
#
# Customize:
#   NOTIFY_SOUND_FILE — full path to custom sound file (overrides built-in)
#   NOTIFY_SOUND_NAME — built-in sound name
#                        macOS: Glass, Hero, Ping, Pop, Purr, Submarine, etc.
#                        Linux: complete, bell, message, etc.
#   NOTIFY_TITLE      — notification title (default: Claude Code)
#   NOTIFY_MESSAGE    — desktop notification text (default: Task complete)
#   NOTIFY_SAY_TEXT   — text to speak aloud (default: falls back to NOTIFY_MESSAGE)
#   NOTIFY_VOICE      — macOS say voice (default: Samantha)
#                        English US: Samantha   English UK: Daniel
#                        English AU: Karen      Japanese: Kyoko
#                        Korean: Yuna           French: Thomas
#                        Portuguese BR: Luciana  Chinese TW: Meijia
#                        Cantonese HK: Sinji
#                        Run `say -v '?'` to list all available voices
#
# Auto-detects platform. Missing tools are silently skipped.

# Drain stdin (required to prevent broken pipe, but we don't need the data)
cat > /dev/null

# Ensure approve is always output, even if something crashes
trap 'echo "{\"decision\":\"approve\"}"' EXIT

# --- Config ---
SOUND="${NOTIFY_SOUND:-1}"
DESKTOP="${NOTIFY_DESKTOP:-1}"
SAY="${NOTIFY_SAY:-0}"
TITLE="${NOTIFY_TITLE:-Claude Code}"
MESSAGE="${NOTIFY_MESSAGE:-Task complete}"
SAY_TEXT="${NOTIFY_SAY_TEXT:-$MESSAGE}"

# --- Helper: find a sound player ---
play_file() {
  local file="$1"
  [ -f "$file" ] || return 0
  if command -v afplay &>/dev/null; then
    ( afplay "$file" & )
  elif command -v paplay &>/dev/null; then
    ( paplay "$file" & )
  elif command -v pw-play &>/dev/null; then
    ( pw-play "$file" & )
  elif command -v aplay &>/dev/null; then
    ( aplay "$file" & )
  fi
}

# --- Sound ---
if [ "$SOUND" = "1" ]; then
  if [ -n "${NOTIFY_SOUND_FILE:-}" ]; then
    play_file "$NOTIFY_SOUND_FILE"
  elif command -v afplay &>/dev/null; then
    play_file "/System/Library/Sounds/${NOTIFY_SOUND_NAME:-Glass}.aiff"
  else
    play_file "/usr/share/sounds/freedesktop/stereo/${NOTIFY_SOUND_NAME:-complete}.oga"
  fi
fi

# --- Desktop notification ---
if [ "$DESKTOP" = "1" ]; then
  if command -v osascript &>/dev/null; then
    # Use argv to pass strings safely (system attribute mangles UTF-8)
    ( osascript -e 'on run argv
      display notification (item 2 of argv) with title (item 1 of argv)
    end run' "$TITLE" "$MESSAGE" & )
  elif command -v notify-send &>/dev/null; then
    ( notify-send -- "$TITLE" "$MESSAGE" & )
  fi
fi

# --- Speak aloud ---
if [ "$SAY" = "1" ]; then
  if command -v say &>/dev/null; then
    ( say -v "${NOTIFY_VOICE:-Samantha}" -- "$SAY_TEXT" & )
  elif command -v espeak-ng &>/dev/null; then
    ( espeak-ng -- "$SAY_TEXT" & )
  elif command -v espeak &>/dev/null; then
    ( espeak -- "$SAY_TEXT" & )
  fi
fi

exit 0
