#!/bin/bash
set -e
# bash wrapper used to run python in background
cat | python3 "${CLAUDE_PLUGIN_ROOT}/hooks/audio_notification_hook.py" >/dev/null 2>&1 &
exit 0
