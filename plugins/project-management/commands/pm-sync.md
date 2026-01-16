---
description: Synchronize current branch with main branch using fetch + rebase (recommended over merge)
allowed-tools: Bash(git:*)
argument-hint: [--force]
---

# Sync with Main Branch

## Current State

- **Current Branch**: !`git branch --show-current`
- **Main Branch**: !`git symbolic-ref refs/remotes/origin/HEAD 2>/dev/null | sed 's@^refs/remotes/origin/@@' || echo "main"`
- **Uncommitted Changes**: !`git status --porcelain | wc -l`
- **Commits Ahead/Behind**: !`git rev-list --left-right --count HEAD...origin/main 2>/dev/null || echo "Unable to compare"`

## Sync Procedure

### Step 1: Pre-flight Check

1. Check for uncommitted changes
   - If changes exist and `$ARGUMENTS` does NOT contain `--force`, warn and stop
   - Suggest: `git stash` or commit changes first

### Step 2: Fetch Latest

```bash
git fetch origin
```

### Step 3: Rebase onto Main

```bash
git rebase origin/main
```

### Step 4: Handle Conflicts (if any)

If conflicts occur:
1. List conflicted files: `git diff --name-only --diff-filter=U`
2. Guide user through resolution
3. After resolution: `git add <resolved_files>`
4. Continue: `git rebase --continue`

If user wants to abort: `git rebase --abort`

## Important Notes

**Why Rebase over Merge?**
- Maintains linear history
- Cleaner commit graph
- Easier to review and bisect

**Prohibited**:
```bash
git merge main   # Unless team explicitly allows
```

**Safe Force Push**:
After rebase, if needed:
```bash
git push --force-with-lease
```
`--force-with-lease` prevents overwriting others commits.

## Post-Sync Verification

After successful sync:
1. Verify branch is up-to-date: `git log --oneline origin/main..HEAD`
2. Run project tests if applicable
3. Continue development
