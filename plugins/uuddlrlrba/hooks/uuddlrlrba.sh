#!/bin/bash
# ⬆️⬆️⬇️⬇️⬅️➡️⬅️➡️🅱️🅰️ → Clawd dance. UserPromptSubmit hook.

input=$(cat)

if ! echo "$input" | grep -qE '(⬆️⬆️⬇️⬇️⬅️➡️⬅️➡️🅱️🅰️|uuddlrlrba)'; then
  echo '{}'
  exit 0
fi

# Render the GIF on alt screen. dirname $0 works because Claude Code
# passes the full expanded path (${CLAUDE_PLUGIN_ROOT} resolved).
python3 "$(dirname "$0")/clawd_dance.py" 2>/dev/null

echo '{"hookSpecificOutput": {"hookEventName": "UserPromptSubmit", "additionalContext": "🦀 +30"}}'
