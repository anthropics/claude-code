#!/bin/bash
# post-git-check.sh - PostToolUse hook for git operations
# Checks for merge conflicts, diverged branches, and other git issues

set -e

INPUT=$(cat)
TOOL_NAME=$(echo "$INPUT" | jq -r '.tool_name // ""')
COMMAND=$(echo "$INPUT" | jq -r '.tool_input.command // ""')
TOOL_RESPONSE=$(echo "$INPUT" | jq -r '.tool_response // ""')

# Only process Bash tool calls with git commands
if [ "$TOOL_NAME" != "Bash" ]; then
    exit 0
fi

if [[ ! "$COMMAND" =~ ^git[[:space:]] ]]; then
    exit 0
fi

# Check for merge conflicts after pull/merge/rebase
if [[ "$COMMAND" =~ git[[:space:]]+(pull|merge|rebase|cherry-pick) ]]; then
    # Check for conflict markers in tracked files
    if git diff --name-only --diff-filter=U 2>/dev/null | head -1 | grep -q .; then
        CONFLICTS=$(git diff --name-only --diff-filter=U 2>/dev/null | head -5)
        echo "⚠️ Merge conflicts detected in:" >&2
        echo "$CONFLICTS" >&2
        echo "Please resolve conflicts before continuing." >&2
        exit 2
    fi
fi

# After checkout, report branch status
if [[ "$COMMAND" =~ git[[:space:]]+checkout ]]; then
    BRANCH=$(git branch --show-current 2>/dev/null || echo "")
    if [ -n "$BRANCH" ]; then
        # Check if branch is behind remote
        git fetch origin "$BRANCH" --quiet 2>/dev/null || true
        BEHIND=$(git rev-list --count "HEAD..origin/$BRANCH" 2>/dev/null || echo "0")
        AHEAD=$(git rev-list --count "origin/$BRANCH..HEAD" 2>/dev/null || echo "0")

        if [ "$BEHIND" -gt 0 ]; then
            echo "Branch '$BRANCH' is $BEHIND commits behind origin" >&2
        fi
        if [ "$AHEAD" -gt 0 ]; then
            echo "Branch '$BRANCH' is $AHEAD commits ahead of origin" >&2
        fi
    fi
fi

# After commit, suggest push if on feature branch
if [[ "$COMMAND" =~ git[[:space:]]+commit ]]; then
    BRANCH=$(git branch --show-current 2>/dev/null || echo "")
    if [[ "$BRANCH" != "main" && "$BRANCH" != "master" && -n "$BRANCH" ]]; then
        UNPUSHED=$(git rev-list --count "origin/$BRANCH..HEAD" 2>/dev/null || echo "?")
        if [ "$UNPUSHED" != "0" ] && [ "$UNPUSHED" != "?" ]; then
            echo "Note: $UNPUSHED unpushed commit(s) on '$BRANCH'"
        fi
    fi
fi

exit 0
