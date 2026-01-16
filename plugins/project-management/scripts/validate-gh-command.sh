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

# Check if it's a gh command
if [[ ! "$COMMAND" =~ ^gh[[:space:]] ]]; then
    exit 0
fi

# Dangerous patterns to warn about
DANGEROUS_PATTERNS=(
    "gh repo delete"
    "gh issue delete"
    "gh release delete"
    "gh pr close.*--delete-branch"
)

# Check for dangerous patterns
for pattern in "${DANGEROUS_PATTERNS[@]}"; do
    if [[ "$COMMAND" =~ $pattern ]]; then
        echo "Warning: Potentially destructive GitHub operation detected: $COMMAND" >&2
        echo "This operation may permanently delete resources." >&2
        # Don't block, just warn (exit 0)
        exit 0
    fi
done

# Check for operations that should prompt for confirmation
CONFIRM_PATTERNS=(
    "gh pr merge(?!.*--auto)"
    "gh issue close"
    "gh pr close"
)

for pattern in "${CONFIRM_PATTERNS[@]}"; do
    if [[ "$COMMAND" =~ $pattern ]]; then
        echo "Note: This operation will modify GitHub resources. Ensure you have the correct PR/issue number." >&2
        exit 0
    fi
done

# Check auth status for operations that require it
AUTH_REQUIRED=(
    "gh pr create"
    "gh issue create"
    "gh release create"
    "gh pr merge"
    "gh pr review"
)

for pattern in "${AUTH_REQUIRED[@]}"; do
    if [[ "$COMMAND" =~ $pattern ]]; then
        # Check if authenticated
        if ! gh auth status > /dev/null 2>&1; then
            echo "BLOCKED: GitHub CLI not authenticated" >&2
            echo "Run 'gh auth login' first" >&2
            exit 2  # Block the operation
        fi
        break
    fi
done

exit 0
