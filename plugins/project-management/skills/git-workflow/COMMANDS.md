# Git Commands Reference

## Daily Workflow Commands

### Start New Work
```bash
# 1. Update main
git checkout main
git pull origin main

# 2. Create feature branch
git checkout -b feature/123-description

# 3. Push branch for Draft PR
git push -u origin feature/123-description
```

### Development Cycle
```bash
# Check status
git status
git diff

# Stage changes (precise)
git add path/to/file1
git add path/to/file2

# Or interactive staging
git add -p

# Commit
git commit -m "feat(scope): description (#123)"

# Push
git push
```

### Sync with Main
```bash
# Fetch and rebase
git fetch origin
git rebase origin/main

# If conflicts
git add <resolved_files>
git rebase --continue

# Push (after rebase)
git push --force-with-lease
```

### Before PR Review
```bash
# Check status
git status
git log --oneline --decorate -5

# Ensure no uncommitted changes
```

### After Review - Fix Issues
```bash
# Edit files
# ...

# Commit fix
git add <files>
git commit -m "fix(review): handle edge case"

# Push
git push
```

### Squash Before Merge (Optional)
```bash
# View commits
git log --oneline origin/main..HEAD

# Interactive rebase
git rebase -i origin/main

# In editor: change 'pick' to 'squash' for all but first

# Force push
git push --force-with-lease
```

### After Merge - Cleanup
```bash
# Switch to main
git checkout main
git pull origin main

# Delete local branch
git branch -d feature/123-description

# Delete remote branch
git push origin --delete feature/123-description
```

## Quick Reference Table

| Stage | Command |
|-------|---------|
| Create branch | `git checkout -b feature/xxx` |
| Push branch | `git push -u origin feature/xxx` |
| Commit | `git add` + `git commit` |
| Sync main | `git fetch` + `git rebase origin/main` |
| Fix review | commit + `git push` |
| Squash | `git rebase -i origin/main` |
| Safe force push | `git push --force-with-lease` |
| Delete branch | `git branch -d` |

## Troubleshooting

### Undo Last Commit (Keep Changes)
```bash
git reset --soft HEAD~1
```

### Undo Last Commit (Discard Changes)
```bash
git reset --hard HEAD~1
```

### Recover Lost Commit
```bash
git reflog
git checkout <commit-hash>
```

### Abort Rebase
```bash
git rebase --abort
```

### Fix Commit Message
```bash
git commit --amend
```
