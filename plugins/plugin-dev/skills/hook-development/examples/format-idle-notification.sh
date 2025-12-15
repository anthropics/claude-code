#!/bin/bash
# Example: Format teammate idle notification
#
# This script demonstrates how to format raw JSON idle notifications
# into user-friendly display format.
#
# Usage: echo '{"type":"idle_notification","from":"worker-1","timestamp":"..."}' | ./format-idle-notification.sh

set -euo pipefail

# Read JSON from stdin
input=$(cat)

# Parse notification type
notification_type=$(echo "$input" | jq -r '.type // empty' 2>/dev/null || echo "")

if [[ "$notification_type" == "idle_notification" ]]; then
  # Extract fields
  worker_name=$(echo "$input" | jq -r '.from // "worker"')
  timestamp=$(echo "$input" | jq -r '.timestamp // empty')

  # Format timestamp if present
  time_str=""
  if [[ -n "$timestamp" ]]; then
    # Try to format the timestamp
    time_str=$(date -d "$timestamp" '+%H:%M:%S' 2>/dev/null || echo "")
  fi

  # Output formatted notification using recommended format:
  # ⏺ worker-1
  #   ⎿ Status is idle
  echo "⏺ $worker_name"
  if [[ -n "$time_str" ]]; then
    echo "  ⎿ Status is idle ($time_str)"
  else
    echo "  ⎿ Status is idle"
  fi

  # Output JSON for hook system
  if [[ -n "$time_str" ]]; then
    jq -n --arg msg "⏺ $worker_name\n  ⎿ Status is idle ($time_str)" \
      '{"systemMessage": $msg}'
  else
    jq -n --arg msg "⏺ $worker_name\n  ⎿ Status is idle" \
      '{"systemMessage": $msg}'
  fi
else
  # Not an idle notification, pass through
  echo "$input"
fi
