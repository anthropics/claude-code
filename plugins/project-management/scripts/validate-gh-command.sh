#!/bin/bash
# Validate GitHub CLI Command Hook
# Runs before Bash tool to check for dangerous gh operations

set -e

# Read input from stdin
INPUT=$(cat)

# Extract command from JSON input
COMMAND=$(echo "$INPUT" | jq -r '.tool_input.command // empty')

if [ -z "$COMMAND" ]; then
    exit 0
fi

# Check if it is a gh command
if [[ ! "$COMMAND" =~ ^gh[[:space:]] ]]; then
    exit 0
fi

# Warn about destructive operations
if [[ "$COMMAND" =~ gh[[:space:]]repo[[:space:]]delete ]]; then
    echo "Warning: gh repo delete will permanently delete the repository" >&2
fi

if [[ "$COMMAND" =~ gh[[:space:]]issue[[:space:]]delete ]]; then
    echo "Warning: gh issue delete will permanently delete the issue" >&2
fi

if [[ "$COMMAND" =~ gh[[:space:]]release[[:space:]]delete ]]; then
    echo "Warning: gh release delete will permanently delete the release" >&2
fi

# Check auth for operations that require it
AUTH_REQUIRED="gh pr create gh issue create gh release create gh pr merge gh pr review"

for pattern in $AUTH_REQUIRED; do
    if [[ "$COMMAND" =~ $pattern ]]; then
        if ! gh auth status > /dev/null 2>&1; then
            echo "BLOCKED: GitHub CLI not authenticated" >&2
            echo "Run 'gh auth login' first" >&2
            exit 2
        fi
        break
    fi
done

exit 0
