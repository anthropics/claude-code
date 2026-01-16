#!/bin/bash
# Check Uncommitted Changes Hook
# Runs after Write/Edit operations to remind about commits

set -e

# Check if we're in a Git repository
if ! git rev-parse --git-dir > /dev/null 2>&1; then
    exit 0
fi

# Get uncommitted changes count
UNCOMMITTED=$(git status --porcelain 2>/dev/null | wc -l | tr -d ' ')

# Only output if there are significant uncommitted changes
if [ "$UNCOMMITTED" -gt 5 ]; then
    echo "Note: ${UNCOMMITTED} uncommitted changes. Consider committing with /pm-commit"
fi

exit 0
