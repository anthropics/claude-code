#!/bin/bash
# Check Uncommitted Changes Hook
# Runs after file modifications to remind about uncommitted changes

set -e

# Check if in Git repository
if ! git rev-parse --git-dir > /dev/null 2>&1; then
    exit 0
fi

# Count uncommitted changes
UNCOMMITTED=$(git status --porcelain 2>/dev/null | wc -l | tr -d ' ')

if [ "$UNCOMMITTED" -gt 5 ]; then
    echo "Note: You have ${UNCOMMITTED} uncommitted changes. Consider committing with /pm-commit." >&2
fi

exit 0
