#!/usr/bin/env bash
#
# Claude Code Hook: Session Primer
# ==================================
# This hook runs as a SessionStart hook to inject project context
# at the beginning of every Claude Code session. It gathers git
# state and outputs it so Claude starts with awareness of recent
# changes and the current branch.
#
# Read more about hooks here: https://docs.anthropic.com/en/docs/claude-code/hooks
#
# Hook configuration (add to your settings.json or .claude/settings.json):
#
# {
#   "hooks": {
#     "SessionStart": [
#       {
#         "hooks": [
#           {
#             "type": "command",
#             "command": "/path/to/claude-code/examples/hooks/session_primer_example.sh"
#           }
#         ]
#       }
#     ]
#   }
# }
#

set -euo pipefail

# Only run inside a git repository
if ! git rev-parse --is-inside-work-tree > /dev/null 2>&1; then
    exit 0
fi

echo "=== Session Context ==="
echo ""

# Current branch
echo "Branch: $(git branch --show-current 2>/dev/null || echo 'detached HEAD')"
echo ""

# Recent commits (last 5)
echo "Recent commits:"
git log --oneline -5 2>/dev/null || echo "  (no commits yet)"
echo ""

# Working tree status (short format)
STATUS=$(git status --short 2>/dev/null)
if [ -n "$STATUS" ]; then
    echo "Uncommitted changes:"
    echo "$STATUS"
else
    echo "Working tree is clean."
fi
echo ""

echo "======================="

# Exit code 0 allows the session to proceed normally.
# The output above is shown to Claude as additional context.
exit 0
