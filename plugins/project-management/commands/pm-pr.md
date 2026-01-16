---
description: Pull Request operations - create draft PR, mark ready for review, check PR status
allowed-tools: Bash(git:*), Bash(gh:*)
argument-hint: draft [title] | ready | status | review-fix [message]
---

# Pull Request Management

## Current Context

- **Current Branch**: !`git branch --show-current`
- **Main Branch**: !`git symbolic-ref refs/remotes/origin/HEAD 2>/dev/null | sed 's@^refs/remotes/origin/@@' || echo "main"`
- **Commits to Push**: !`git log --oneline origin/$(git branch --show-current)..HEAD 2>/dev/null | wc -l`
- **Recent Commits**: !`git log --oneline -5`

## Command: $1

### PR Operations

**If `draft` - Create Draft PR**:

1. Ensure branch is pushed: `git push -u origin $(git branch --show-current)`
2. Create draft PR using GitHub CLI:
```bash
gh pr create --draft --title "$2" --body "## Description

TODO: Add description

## Related Issue

Fixes #<issue-number>

## Checklist

- [ ] Code follows project style
- [ ] Tests added/updated
- [ ] Documentation updated
"
```

**If `ready` - Mark Ready for Review**:

1. Check current PR exists
2. Mark as ready:
```bash
gh pr ready
```

**If `status` - Check PR Status**:

```bash
gh pr view --json title,state,reviews,checks,mergeable
```

**If `review-fix` - Address Review Comments**:

1. Make code changes
2. Commit with message: `fix(review): $2`
3. Push to same branch: `git push`
4. Do NOT:
   - Create new branch
   - Close PR
   - Create new Issue

## Best Practices

1. **Title**: Include Issue number, be concise
2. **Description**: Clear, with TODO checklist
3. **Draft First**: Always start as Draft
4. **Small PRs**: Easier to review
5. **One Concern**: Each PR addresses one issue/feature
