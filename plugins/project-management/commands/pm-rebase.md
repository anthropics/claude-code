---
description: Interactive rebase to clean up commit history before PR merge
allowed-tools: Bash(git:*)
argument-hint: [squash] [--onto <branch>]
---

# Interactive Rebase

## Current State

- **Current Branch**: !`git branch --show-current`
- **Commits Since Main**: !`git log --oneline origin/main..HEAD`
- **Total Commits**: !`git rev-list --count origin/main..HEAD`

## Rebase Operations

### View Commit History

```bash
git log --oneline origin/main..HEAD
```

### Interactive Rebase

**If `$1` is `squash`**:
Squash all commits into one:
```bash
git rebase -i origin/main
```

In editor, change all `pick` to `squash` (or `s`) except the first one:
```
pick a1b2 feat(auth): add jwt login
squash c3d4 fix(review): handle nil token
squash e5f6 test(auth): add unit tests
```

**If `--onto <branch>` specified**:
```bash
git rebase --onto $3 origin/main HEAD
```

### Standard Interactive Rebase

```bash
git rebase -i origin/main
```

## Rebase Commands Reference

| Command | Short | Description |
|---------|-------|-------------|
| `pick` | `p` | Use commit as-is |
| `reword` | `r` | Use commit, edit message |
| `edit` | `e` | Stop for amending |
| `squash` | `s` | Meld into previous commit |
| `fixup` | `f` | Like squash, discard message |
| `drop` | `d` | Remove commit |
| `reorder` | - | Change line order to reorder |

## After Rebase

**Force Push Required**:
```bash
git push --force-with-lease
```

**Why `--force-with-lease`**:
- Safer than `--force`
- Fails if remote has new commits you don't have
- Prevents accidentally overwriting others' work

## Conflict Resolution

If conflicts during rebase:

1. View conflicted files:
```bash
git diff --name-only --diff-filter=U
```

2. Resolve conflicts in each file

3. Stage resolved files:
```bash
git add <resolved_files>
```

4. Continue rebase:
```bash
git rebase --continue
```

5. Or abort if needed:
```bash
git rebase --abort
```

## Best Practices

1. **Squash before merge**: Clean history for main branch
2. **Never rebase public branches**: Only rebase your own feature branches
3. **Communicate**: Tell team before force-pushing shared branches
4. **Backup**: Create backup branch before complex rebases
   ```bash
   git branch backup-$(git branch --show-current)
   ```
