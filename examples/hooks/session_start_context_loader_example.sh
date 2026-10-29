#!/usr/bin/env bash
#
# Claude Code Hook: Session Start Context Loader
# ================================================
# This hook runs as a SessionStart hook that loads project-specific context
# from a file and feeds it to Claude at the beginning of every session.
#
# This is useful for giving Claude persistent instructions like coding
# conventions, project rules, or architecture notes — without repeating
# yourself every time you start a session.
#
# The hook looks for a context file at .claude/project-context.md in your
# project directory. If the file exists, its contents are passed to Claude
# as additional context. If it doesn't exist, the hook exits silently.
#
# Requires: jq (https://jqlang.github.io/jq/)
#
# Read more about hooks here: https://docs.anthropic.com/en/docs/claude-code/hooks
#
# Make sure to change your path to your actual script.
#
# {
#   "hooks": {
#     "SessionStart": [
#       {
#         "hooks": [
#           {
#             "type": "command",
#             "command": "bash /path/to/claude-code/examples/hooks/session_start_context_loader_example.sh"
#           }
#         ]
#       }
#     ]
#   }
# }
#

CONTEXT_FILE="${CLAUDE_PROJECT_DIR:-.}/.claude/project-context.md"

if [ ! -f "$CONTEXT_FILE" ]; then
    exit 0
fi

if ! command -v jq &> /dev/null; then
    echo "Error: jq is required but not installed" >&2
    # Exit code 1 shows stderr to the user but not to Claude
    exit 1
fi

CONTENT=$(cat "$CONTEXT_FILE")

# Use jq to safely encode the file content as a JSON string.
# This handles all special characters (newlines, quotes, backslashes,
# control characters, Unicode) correctly.
jq -n --arg ctx "$CONTENT" '{
  hookSpecificOutput: {
    hookEventName: "SessionStart",
    additionalContext: $ctx
  }
}'

exit 0
