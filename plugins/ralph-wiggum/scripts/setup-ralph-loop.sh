#!/bin/bash

# Ralph Loop Setup Script
# Creates state file for in-session Ralph loop

set -euo pipefail

PROMPT_PARTS=()
MAX_ITERATIONS=0
COMPLETION_PROMISE="null"
SESSION_ID=""

while [[ $# -gt 0 ]]; do
  case $1 in
    -h|--help)
      cat <<'HELP_EOF'
Ralph Loop - Interactive self-referential development loop

USAGE:
  /ralph-loop [PROMPT...] [OPTIONS]

ARGUMENTS:
  PROMPT...    Initial prompt to start the loop (can be multiple words without quotes)

OPTIONS:
  --max-iterations <n>           Maximum iterations before auto-stop (default: unlimited)
  --completion-promise '<text>'  Promise phrase (USE QUOTES for multi-word)
  -h, --help                     Show this help message

DESCRIPTION:
  Starts a Ralph Wiggum loop in your CURRENT session. The stop hook prevents
  exit and feeds your output back as input until completion or iteration limit.

  To signal completion, you must output: <promise>YOUR_PHRASE</promise>

EXAMPLES:
  /ralph-loop Build a todo API --completion-promise 'DONE' --max-iterations 20
  /ralph-loop --max-iterations 10 Fix the auth bug
  /ralph-loop Refactor cache layer
  /ralph-loop --completion-promise 'TASK COMPLETE' Create a REST API

STOPPING:
  Only by reaching --max-iterations or detecting --completion-promise.
  No manual stop - Ralph runs forever by default.

MONITORING:
  grep '^iteration:' .claude/ralph-loop.local.md
  head -10 .claude/ralph-loop.local.md
HELP_EOF
      exit 0
      ;;
    --max-iterations)
      if [[ -z "${2:-}" ]]; then
        echo "Error: --max-iterations requires a number argument" >&2
        exit 1
      fi
      if ! [[ "$2" =~ ^[0-9]+$ ]]; then
        echo "Error: --max-iterations must be a positive integer or 0, got: $2" >&2
        exit 1
      fi
      MAX_ITERATIONS="$2"
      shift 2
      ;;
    --completion-promise)
      if [[ -z "${2:-}" ]]; then
        echo "Error: --completion-promise requires a text argument" >&2
        echo "Note: Multi-word promises must be quoted." >&2
        exit 1
      fi
      COMPLETION_PROMISE="$2"
      shift 2
      ;;
    --session-id)
      if [[ -z "${2:-}" ]]; then
        echo "Error: --session-id requires a session identifier" >&2
        exit 1
      fi
      SESSION_ID="$2"
      shift 2
      ;;
    *)
      PROMPT_PARTS+=("$1")
      shift
      ;;
  esac
done

PROMPT="${PROMPT_PARTS[*]}"

if [[ -z "$PROMPT" ]]; then
  echo "Error: No prompt provided" >&2
  echo "Try: /ralph-loop Build a REST API for todos" >&2
  exit 1
fi

if [[ -z "$SESSION_ID" ]]; then
  SESSION_ID="${RALPH_WIGGUM_SESSION_ID:-${CLAUDE_SESSION_ID:-${CLAUDE_CODE_SESSION_ID:-}}}"
fi

if [[ -z "$SESSION_ID" ]]; then
  echo "Error: Unable to determine the current Claude session ID" >&2
  echo "" >&2
  echo "Ralph loop now stores the originating session so it does not block" >&2
  echo "unrelated parallel sessions." >&2
  echo "" >&2
  echo "Restart Claude Code and try /ralph-loop again." >&2
  exit 1
fi

mkdir -p .claude

if [[ -n "$COMPLETION_PROMISE" ]] && [[ "$COMPLETION_PROMISE" != "null" ]]; then
  COMPLETION_PROMISE_YAML="\"$COMPLETION_PROMISE\""
else
  COMPLETION_PROMISE_YAML="null"
fi

cat > .claude/ralph-loop.local.md <<EOF
---
active: true
session_id: $SESSION_ID
iteration: 1
max_iterations: $MAX_ITERATIONS
completion_promise: $COMPLETION_PROMISE_YAML
started_at: "$(date -u +%Y-%m-%dT%H:%M:%SZ)"
---

$PROMPT
EOF

cat <<EOF
[ralph-loop] Activated in this session

Iteration: 1
Max iterations: $(if [[ $MAX_ITERATIONS -gt 0 ]]; then echo "$MAX_ITERATIONS"; else echo "unlimited"; fi)
Completion promise: $(if [[ "$COMPLETION_PROMISE" != "null" ]]; then echo "${COMPLETION_PROMISE//\"/}"; else echo "none"; fi)

When you try to exit, Ralph will feed the same prompt back to this session.
Monitor state with: head -10 .claude/ralph-loop.local.md
EOF

if [[ -n "$PROMPT" ]]; then
  echo ""
  echo "$PROMPT"
fi

if [[ "$COMPLETION_PROMISE" != "null" ]]; then
  cat <<EOF

------------------------------------------------------------
Ralph Loop Completion Promise
------------------------------------------------------------
To complete this loop, output this exact text:
  <promise>$COMPLETION_PROMISE</promise>

Only output that promise when it is completely true.
Do not use it just to escape the loop.
------------------------------------------------------------
EOF
fi
