---
allowed-tools: Bash(git:*)
description: Show detailed git branch and repository info
---

## Context

- Current branch: !`git branch --show-current`
- All local branches: !`git branch -v`
- Remote tracking: !`git remote -v`
- Status: !`git status --short`
- Recent commits on this branch: !`git log --oneline -5`
- Upstream status: !`git rev-list --left-right --count HEAD...@{upstream} 2>/dev/null || echo "no upstream"`

## Your task

Present a clean, concise summary of the git state. Show:
1. Current branch (highlighted)
2. Whether there are uncommitted changes
3. Ahead/behind upstream status
4. Recent commits (last 5)
5. Other local branches

Keep it short and scannable.
