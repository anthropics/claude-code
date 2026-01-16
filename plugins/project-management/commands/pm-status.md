---
description: Display comprehensive project Git status including branch, changes, and recent commits
allowed-tools: Bash(git:*)
argument-hint: [--full]
---

# Project Status Overview

## Current Context

- **Current Branch**: !`git branch --show-current`
- **Remote Tracking**: !`git rev-parse --abbrev-ref --symbolic-full-name @{u} 2>/dev/null || echo "No upstream configured"`
- **Repository Root**: !`git rev-parse --show-toplevel`

## Working Directory Status

!`git status --short`

## Staged Changes

!`git diff --cached --stat 2>/dev/null || echo "No staged changes"`

## Recent Commits (Last 5)

!`git log --oneline --decorate -5`

## Branch Information

!`git branch -vv --list | head -10`

## Instructions

Based on the above context, provide:

1. **Summary**: Current branch status and working state
2. **Pending Work**: Any uncommitted or unstaged changes
3. **Sync Status**: Whether local branch is ahead/behind remote
4. **Recommendations**: Next steps based on current state

If `$ARGUMENTS` contains `--full`, also include:
- Stash list
- Recent reflog entries
- Remote information
