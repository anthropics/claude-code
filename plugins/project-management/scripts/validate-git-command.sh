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

# Check if it is a git command
if [[ ! "$COMMAND" =~ ^git[[:space:]] ]]; then
    exit 0
fi

# Protected branches
PROTECTED_BRANCHES="main master develop production staging"

# Check for force push to protected branches
if [[ "$COMMAND" =~ git[[:space:]]push.*--force[[:space:]] ]] || [[ "$COMMAND" =~ git[[:space:]]push.*-f[[:space:]] ]]; then
    for branch in $PROTECTED_BRANCHES; do
        if [[ "$COMMAND" =~ $branch ]]; then
            echo "BLOCKED: Force push to protected branch '$branch' is not allowed" >&2
            echo "Use --force-with-lease for safer force pushing on feature branches" >&2
            exit 2
        fi
    done
    
    # Warn about force push but allow if not to protected branch
    if [[ ! "$COMMAND" =~ --force-with-lease ]]; then
        echo "Warning: Consider using --force-with-lease instead of --force" >&2
    fi
fi

# Warn about dangerous operations
if [[ "$COMMAND" =~ git[[:space:]]reset[[:space:]]--hard ]]; then
    echo "Warning: git reset --hard will discard all uncommitted changes" >&2
fi

if [[ "$COMMAND" =~ git[[:space:]]clean[[:space:]].*-fd ]]; then
    echo "Warning: git clean -fd will permanently delete untracked files" >&2
fi

exit 0
