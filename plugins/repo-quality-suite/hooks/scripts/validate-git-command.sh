#!/bin/bash
# validate-git-command.sh - PreToolUse hook to validate git commands for safety
# Exit codes: 0 = allow, 2 = block with feedback

set -e

# Read input from stdin
INPUT=$(cat)
TOOL_NAME=$(echo "$INPUT" | jq -r '.tool_name // ""')
COMMAND=$(echo "$INPUT" | jq -r '.tool_input.command // ""')

# Only process Bash tool calls
if [ "$TOOL_NAME" != "Bash" ]; then
    exit 0
fi

# Only process git commands
if [[ ! "$COMMAND" =~ ^git[[:space:]] ]]; then
    exit 0
fi

# List of dangerous git operations to block
DANGEROUS_PATTERNS=(
    "git push.*--force"
    "git push.*-f[[:space:]]"
    "git reset --hard"
    "git clean -fd"
    "git checkout -f"
    "git branch -D"
    "git reflog expire"
    "git gc --prune"
)

for pattern in "${DANGEROUS_PATTERNS[@]}"; do
    if [[ "$COMMAND" =~ $pattern ]]; then
        echo "Blocked dangerous git command: $COMMAND" >&2
        echo "This operation could cause data loss. Please confirm explicitly if you want to proceed." >&2
        exit 2
    fi
done

# Warn about operations on main/master
if [[ "$COMMAND" =~ "git push".*"(main|master)" ]] && [[ ! "$COMMAND" =~ "--force" ]]; then
    echo "Note: Pushing to main/master branch" >&2
fi

# All checks passed
exit 0
