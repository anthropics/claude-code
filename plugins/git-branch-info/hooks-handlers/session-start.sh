#!/bin/bash

# Detect git branch and status at session start
# Returns additionalContext so Claude is always aware of the git state

branch=$(git branch --show-current 2>/dev/null)

if [ -z "$branch" ]; then
  # Not in a git repo
  cat << 'EOF'
{
  "hookSpecificOutput": {
    "hookEventName": "SessionStart",
    "additionalContext": "This directory is not a git repository."
  }
}
EOF
  exit 0
fi

# Gather useful git info
dirty=""
if [ -n "$(git status --porcelain 2>/dev/null)" ]; then
  dirty=" (dirty)"
fi

ahead_behind=$(git rev-list --left-right --count HEAD...@{upstream} 2>/dev/null)
if [ -n "$ahead_behind" ]; then
  ahead=$(echo "$ahead_behind" | cut -f1)
  behind=$(echo "$ahead_behind" | cut -f2)
  sync=""
  [ "$ahead" -gt 0 ] && sync=" +${ahead}"
  [ "$behind" -gt 0 ] && sync="${sync} -${behind}"
else
  sync=""
fi

last_commit=$(git log --oneline -1 2>/dev/null)

cat << EOF
{
  "hookSpecificOutput": {
    "hookEventName": "SessionStart",
    "additionalContext": "[git-branch-info] Branch: ${branch}${dirty}${sync} | Last commit: ${last_commit}"
  }
}
EOF
