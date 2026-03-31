#!/usr/bin/env bash
# safety-gate.sh — Blocks destructive commands in unattended sessions
#
# PreToolUse hook for Bash tool: checks command for dangerous patterns.
# Blocks: rm -rf, git push --force, DROP TABLE, deploys, secret access.
#
# Copyright 2026 Stackbilt LLC — Apache 2.0

INPUT=$(cat)
TOOL=$(echo "$INPUT" | jq -r '.tool_name // empty' 2>/dev/null)

if [[ "$TOOL" != "Bash" ]]; then
  exit 0
fi

CMD=$(echo "$INPUT" | jq -r '.tool_input.command // empty' 2>/dev/null)

# Destructive filesystem operations
if echo "$CMD" | grep -qiE '(rm\s+-rf|rm\s+-r\s+/|>\s*/dev/)'; then
  echo "BLOCKED: Destructive filesystem operation not allowed in autonomous mode" >&2
  exit 2
fi

# Destructive git operations
if echo "$CMD" | grep -qiE '(git\s+reset\s+--hard|git\s+push\s+--force|git\s+push\s+-f|git\s+clean\s+-f)'; then
  echo "BLOCKED: Destructive git operation not allowed in autonomous mode" >&2
  exit 2
fi

# Database destruction
if echo "$CMD" | grep -qiE '(DROP\s+TABLE|TRUNCATE\s+TABLE|DELETE\s+FROM\s+\w+\s*$)'; then
  echo "BLOCKED: Destructive database operation not allowed in autonomous mode" >&2
  exit 2
fi

# Production deploys (require human approval)
if echo "$CMD" | grep -qiE '(wrangler\s+deploy|wrangler\s+publish|npm\s+run\s+deploy|kubectl\s+apply|terraform\s+apply)'; then
  echo "BLOCKED: Production deploys require human approval. Commit your work and stop." >&2
  exit 2
fi

# Secret management
if echo "$CMD" | grep -qiE '(wrangler\s+secret|echo\s+.*API_KEY|echo\s+.*TOKEN|echo\s+.*SECRET)'; then
  echo "BLOCKED: Secret management not allowed in autonomous mode" >&2
  exit 2
fi

exit 0
