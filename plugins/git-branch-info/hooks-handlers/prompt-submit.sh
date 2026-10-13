#!/bin/bash

# Injects current branch as context on each user prompt
# This ensures Claude always knows the active branch, even after switches

branch=$(git branch --show-current 2>/dev/null)

if [ -z "$branch" ]; then
  exit 0
fi

dirty=""
if [ -n "$(git status --porcelain 2>/dev/null)" ]; then
  dirty="*"
fi

cat << EOF
{
  "hookSpecificOutput": {
    "hookEventName": "UserPromptSubmit",
    "additionalContext": "[git] ${branch}${dirty}"
  }
}
EOF
