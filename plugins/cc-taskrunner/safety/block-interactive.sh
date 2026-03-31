#!/usr/bin/env bash
# block-interactive.sh — Blocks AskUserQuestion in unattended sessions
#
# PreToolUse hook: exits 2 to block, 0 to allow.
# When Claude tries to ask a question, this forces it to decide instead.
#
# Copyright 2026 Stackbilt LLC — Apache 2.0

INPUT=$(cat)
TOOL=$(echo "$INPUT" | jq -r '.tool_name // empty' 2>/dev/null)

if [[ "$TOOL" == "AskUserQuestion" ]]; then
  echo "BLOCKED: Autonomous mode — do not ask questions. Make a reasonable decision and document your reasoning." >&2
  exit 2
fi

exit 0
