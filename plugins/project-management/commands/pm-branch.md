---
description: Branch operations - create, switch, delete feature branches with proper naming conventions
allowed-tools: Bash(git:*)
argument-hint: create <issue-number> <description> | switch <branch-name> | delete <branch-name> | list
---

# Branch Management

## Current State

- **Current Branch**: !`git branch --show-current`
- **All Branches**: !`git branch -a --list | head -20`

## Command: $1

### Action Details

Based on the command `$1`:

**If `create`**:
1. Ensure we are on main/master branch and it is up-to-date
2. Create branch with naming convention: `feature/$2-$3` or `fix/$2-$3` or `hotfix/$2-$3`
3. Push branch to origin with upstream tracking: `git push -u origin <branch-name>`

Example branch names:
- `feature/123-user-login`
- `fix/456-null-pointer`
- `hotfix/789-security-patch`

**If `switch`**:
1. Check for uncommitted changes
2. If changes exist, warn user and suggest stash
3. Switch to branch: `git checkout $2`

**If `delete`**:
1. Ensure not on the branch to be deleted
2. Check if branch is merged
3. Delete local: `git branch -d $2`
4. Ask before deleting remote: `git push origin --delete $2`

**If `list`**:
1. Show all local branches with last commit info
2. Highlight current branch
3. Show tracking status

## Naming Convention

```
<type>/<issue-number>-<short-description>

Types:
- feature: New functionality
- fix: Bug fixes
- hotfix: Urgent production fixes
- refactor: Code refactoring
- docs: Documentation updates
- test: Test additions/modifications
```

## Safety Checks

Before any branch operation:
- Verify repository state is clean (or handle dirty state)
- Confirm destructive operations with user
- Never force-delete unmerged branches without explicit confirmation
