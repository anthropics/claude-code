---
description: Create semantic commits following conventional commit format with proper message structure
allowed-tools: Bash(git:*)
argument-hint: [--amend] | [message]
---

# Semantic Commit

## Current Changes

- **Staged Files**: !`git diff --cached --name-status`
- **Unstaged Files**: !`git diff --name-status`
- **Untracked Files**: !`git ls-files --others --exclude-standard | head -10`

## Staged Diff Preview

!`git diff --cached --stat`

## Commit Message Format

```
<type>(<scope>): <subject> (#<issue>)

[optional body]

[optional footer(s)]
```

### Types

| Type | Description | Example |
|------|-------------|---------|
| `feat` | New feature | `feat(auth): add jwt login (#123)` |
| `fix` | Bug fix | `fix(api): handle null response (#456)` |
| `docs` | Documentation | `docs(readme): update install guide` |
| `style` | Formatting (no logic change) | `style(lint): fix indentation` |
| `refactor` | Code restructuring | `refactor(core): extract helper functions` |
| `perf` | Performance improvement | `perf(query): optimize database calls` |
| `test` | Adding tests | `test(auth): add unit tests for login` |
| `chore` | Build/tooling changes | `chore(deps): update dependencies` |
| `ci` | CI configuration | `ci(github): add workflow for tests` |

### Rules

1. Subject line <= 50 characters
2. Use imperative mood: "add" not "added" or "adds"
3. No period at end of subject
4. Body wraps at 72 characters
5. Explain what and why, not how

## Action

**If `$ARGUMENTS` contains `--amend`**:
```bash
git commit --amend
```

**If `$ARGUMENTS` contains a message**:
Analyze the staged changes and create a commit with the provided message context.

**If no arguments**:
1. Analyze staged changes
2. Suggest appropriate type and scope
3. Generate commit message
4. Confirm with user before committing

## Interactive Staging (if needed)

For precise control over what to commit:
```bash
git add -p  # Interactive patch staging
```

## Post-Commit

After successful commit:
1. Show commit details: `git log -1 --pretty=full`
2. Remind about push: `git push`
