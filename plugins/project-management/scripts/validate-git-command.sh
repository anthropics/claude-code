#!/bin/bash
# Validate Git Command Hook
# Runs before Bash tool to check for dangerous Git operations

set -e

# Read input from stdin
INPUT=$(cat)

# Extract command from JSON input
COMMAND=$(echo "$INPUT" | jq -r '.tool_input.command // empty')

if [ -z "$COMMAND" ]; then
    exit 0
fi

# Check if it's a git command
if [[ ! "$COMMAND" =~ ^git[[:space:]] ]]; then
    exit 0
fi

# Dangerous patterns to warn about
DANGEROUS_PATTERNS=(
    "git push --force[^-]"
    "git push -f[^o]"
    "git reset --hard"
    "git clean -fd"
    "git checkout -- \."
    "git branch -D"
)

# Check for dangerous patterns
for pattern in "${DANGEROUS_PATTERNS[@]}"; do
    if [[ "$COMMAND" =~ $pattern ]]; then
        echo "Warning: Potentially dangerous Git operation detected: $COMMAND" >&2
        echo "Consider using safer alternatives:" >&2
        echo "  - Use 'git push --force-with-lease' instead of '--force'" >&2
        echo "  - Use 'git reset --soft' to preserve changes" >&2
        echo "  - Use 'git branch -d' (lowercase) for safe branch deletion" >&2
        # Don't block, just warn (exit 0)
        exit 0
    fi
done

# Check for force push to protected branches
PROTECTED_BRANCHES="main|master|develop|production|staging"
if [[ "$COMMAND" =~ git[[:space:]]push.*--force && "$COMMAND" =~ ($PROTECTED_BRANCHES) ]]; then
    echo "BLOCKED: Force push to protected branch detected" >&2
    echo "Protected branches: main, master, develop, production, staging" >&2
    exit 2  # Block the operation
fi

exit 0
