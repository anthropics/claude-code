---
name: git-workflow
description: Git workflow best practices including commit conventions, rebase vs merge strategies, and version control principles. Use when working with Git operations, commits, branches, or repository management.
---

# Git Workflow Best Practices

This skill provides comprehensive guidance on Git workflows, commit conventions, and version control best practices.

## Core Principles

### 1. Rebase over Merge

**Preferred:**
```bash
git fetch origin
git rebase origin/main
```

**Avoid (unless team allows):**
```bash
git merge main
```

**Why Rebase?**
- Linear, clean history
- Easier to review and bisect
- No merge commits cluttering history

### 2. Atomic Commits

Each commit should:
- Be complete and working
- Address one logical change
- Pass all tests independently

### 3. Conventional Commits

Format:
```
<type>(<scope>): <subject> (#<issue>)

[optional body]

[optional footer]
```

Types:
| Type | Use For |
|------|---------|
| `feat` | New features |
| `fix` | Bug fixes |
| `docs` | Documentation |
| `style` | Formatting |
| `refactor` | Code restructuring |
| `perf` | Performance |
| `test` | Tests |
| `chore` | Maintenance |
| `ci` | CI/CD |

## Branch Strategy

### Branch Naming
```
<type>/<issue-number>-<short-description>
```

Examples:
- `feature/123-user-login`
- `fix/456-null-pointer`
- `hotfix/789-security-patch`

### Branch Lifecycle

1. **Create from main**: Always branch from latest main
2. **Develop**: Make atomic commits
3. **Sync regularly**: Rebase onto main frequently
4. **PR**: Create draft, then ready for review
5. **Merge**: Squash or rebase merge
6. **Delete**: Clean up after merge

## Safe Operations

### Force Push
```bash
# SAFE - prevents overwriting others' work
git push --force-with-lease

# DANGEROUS - avoid
git push --force
```

### Conflict Resolution
```bash
# During rebase
git add <resolved-files>
git rebase --continue

# Or abort
git rebase --abort
```

### Recovery
```bash
# View history of all refs
git reflog

# Recover lost commit
git checkout <commit-hash>
git branch recovery-branch
```

## For detailed command examples, see [COMMANDS.md](COMMANDS.md).
