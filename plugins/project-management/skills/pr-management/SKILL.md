---
name: pr-management
description: Pull Request best practices including Draft PR workflow, review process, and merge strategies. Use when creating PRs, responding to reviews, or preparing code for merge.
---

# Pull Request Management

This skill provides comprehensive guidance on PR creation, review process, and merge strategies.

## PR Lifecycle

### 1. Draft PR Phase

**When to create Draft PR:**
- After first push to feature branch
- Before code is complete
- For early feedback

**Draft PR benefits:**
- Shows work in progress
- Enables early discussion
- CI runs on changes
- No pressure for immediate review

### 2. Development Phase

**In Draft PR:**
- Continue committing
- Push regularly
- Respond to early comments
- Update description as needed

### 3. Ready for Review

**Before marking ready:**
- [ ] All tests pass
- [ ] Code is complete
- [ ] Self-review done
- [ ] Description is current
- [ ] Issue is linked

**Mark ready:**
```bash
gh pr ready
```

### 4. Review Phase

**Responding to feedback:**
```bash
# Make changes based on review
# Edit files...

# Commit with review prefix
git commit -m "fix(review): address null check comment"
git push

# Do NOT:
# - Create new branch
# - Create new PR
# - Close current PR
```

### 5. Merge Phase

**Pre-merge checklist:**
- [ ] All reviews approved
- [ ] All checks passing
- [ ] No merge conflicts
- [ ] History cleaned (if squashing)

## Merge Strategies

### Squash Merge (Recommended)

**Benefits:**
- Clean main history
- One commit per feature
- Easy to revert

### Rebase Merge

**Benefits:**
- Preserves all commits
- Linear history
- Full development trace

### Merge Commit (Avoid if possible)

**Issues:**
- Complex history
- Extra merge commits
- Harder to bisect

## Review Best Practices

### As Reviewer

1. **Be timely**: Review within 24 hours
2. **Be constructive**: Explain why
3. **Be specific**: Point to exact lines
4. **Categorize feedback**:
   - Must fix (blocking)
   - Should fix (non-blocking)
   - Suggestion (optional)

### As Author

1. **Keep PRs small**: < 400 lines ideal
2. **Respond promptly**: Address feedback quickly
3. **Dont argue**: Discuss, then decide
4. **Thank reviewers**: Appreciate their time

## Issue Linking

### Automatic Close Keywords

In PR description or commits:
```
Fixes #123      - Closes issue on merge
Closes #123     - Same
Resolves #123   - Same
```

### Reference Only
```
Refs #123       - Links without closing
Related to #123 - Informal reference
```
