---
description: Clean up merged branches and synchronize repository state
allowed-tools: Bash(git:*)
argument-hint: [--remote] [--all]
---

# Branch Cleanup

## Current State

- **Current Branch**: !`git branch --show-current`
- **Main Branch**: !`git symbolic-ref refs/remotes/origin/HEAD 2>/dev/null | sed 's@^refs/remotes/origin/@@' || echo "main"`

## Merged Branches (Local)

!`git branch --merged main 2>/dev/null | grep -v "main\|master\|\*" | head -20`

## Cleanup Procedure

### Step 1: Switch to Main

```bash
git checkout main
git pull origin main
```

### Step 2: Delete Merged Local Branches

**If `$ARGUMENTS` does NOT contain `--all`**:
- List branches that would be deleted
- Ask for confirmation

```bash
git branch --merged main | grep -v "main\|master\|\*" | xargs -r git branch -d
```

### Step 3: Delete Remote Branches (if `--remote` specified)

```bash
git push origin --delete <branch-name>
```

Or for multiple branches:
```bash
git fetch --prune origin
```

### Step 4: Prune Remote Tracking References

```bash
git remote prune origin
```

## Safety Checks

1. **Never delete**: `main`, `master`, `develop`, `staging`, `production`
2. **Confirm**: All deletions require user confirmation unless `--all`
3. **Unmerged**: Use `-D` only after explicit confirmation

## Post-Cleanup

Verify clean state:
```bash
git branch -a
```

Show what was cleaned:
- Number of local branches deleted
- Number of remote branches deleted
- Current branch status
