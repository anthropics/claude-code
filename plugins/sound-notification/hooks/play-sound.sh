#!/usr/bin/env bash
# Play a notification sound when Claude Code completes a task or needs attention.
# Usage: play-sound.sh [complete|permission]
#
# Configuration via environment variables:
#   CLAUDE_SOUND_DISABLED=1       - Disable all sounds
#   CLAUDE_SOUND_COMPLETE=<path>  - Custom sound file for task completion
#   CLAUDE_SOUND_PERMISSION=<path> - Custom sound file for permission prompts

set -euo pipefail

EVENT_TYPE="${1:-complete}"

if [ "${CLAUDE_SOUND_DISABLED:-}" = "1" ]; then
  exit 0
fi

play_sound() {
  local sound_file="$1"

  if [ "$(uname)" = "Darwin" ]; then
    afplay "$sound_file" &>/dev/null &
  elif command -v paplay &>/dev/null; then
    paplay "$sound_file" &>/dev/null &
  elif command -v aplay &>/dev/null; then
    aplay -q "$sound_file" &>/dev/null &
  elif command -v powershell.exe &>/dev/null; then
    powershell.exe -c "(New-Object Media.SoundPlayer '$sound_file').PlaySync()" &>/dev/null &
  fi
}

play_bell() {
  printf '\a'
}

case "$EVENT_TYPE" in
  complete)
    if [ -n "${CLAUDE_SOUND_COMPLETE:-}" ] && [ -f "${CLAUDE_SOUND_COMPLETE}" ]; then
      play_sound "$CLAUDE_SOUND_COMPLETE"
    elif [ "$(uname)" = "Darwin" ]; then
      play_sound "/System/Library/Sounds/Glass.aiff"
    else
      play_bell
    fi
    ;;
  permission)
    if [ -n "${CLAUDE_SOUND_PERMISSION:-}" ] && [ -f "${CLAUDE_SOUND_PERMISSION}" ]; then
      play_sound "$CLAUDE_SOUND_PERMISSION"
    elif [ "$(uname)" = "Darwin" ]; then
      play_sound "/System/Library/Sounds/Ping.aiff"
    else
      play_bell
    fi
    ;;
esac
