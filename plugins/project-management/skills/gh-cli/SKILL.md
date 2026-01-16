---
name: gh-cli
description: GitHub CLI (gh) command reference and best practices. Use when working with GitHub issues, pull requests, workflows, releases, or any GitHub API operations.
---

# GitHub CLI Reference

This skill provides comprehensive guidance on using GitHub CLI (`gh`) for repository management, issues, PRs, and automation.

## Quick Reference

### Issues

```bash
# List
gh issue list                          # Open issues
gh issue list --state all              # All issues
gh issue list --label bug              # By label
gh issue list --assignee @me           # Assigned to me

# Create
gh issue create --title "Title" --body "Body"
gh issue create -t "Title" -b "Body" -l bug -a user

# Manage
gh issue view 123                      # View
gh issue close 123                     # Close
gh issue reopen 123                    # Reopen
gh issue comment 123 -b "Comment"      # Comment
```

### Pull Requests

```bash
# List
gh pr list                             # Open PRs
gh pr list --author @me                # Your PRs
gh pr status                           # PR status

# Create
gh pr create --title "Title" --body "Body"
gh pr create --draft                   # Draft PR
gh pr create --fill                    # Auto-fill from commits

# Lifecycle
gh pr ready                            # Mark ready
gh pr review --approve                 # Approve
gh pr merge --squash                   # Squash merge
gh pr merge --auto --squash            # Auto-merge

# Checks
gh pr checks                           # View CI status
gh pr checks --watch                   # Watch until complete
```

### Workflows

```bash
gh workflow list                       # List workflows
gh run list                            # Recent runs
gh run view                            # View run
gh run watch                           # Watch run
gh workflow run name.yml               # Trigger workflow
```

### Repository

```bash
gh repo view                           # View repo info
gh repo clone owner/repo               # Clone
gh repo fork                           # Fork
gh repo create name                    # Create new
```

## Issue-PR Linking

### Auto-Close Keywords

In PR body or commits:
```
Fixes #123
Closes #123
Resolves #123
```

### Reference Only
```
Refs #123
Related to #123
```

## Output Formatting

### JSON Output
```bash
gh issue list --json number,title,state
gh pr list --json number,title,author,mergeable
```

### JQ Processing
```bash
gh issue list --json number,title | jq '.[0]'
gh pr list --json title --jq '.[].title'
```

## Common Patterns

### Create Issue from Template
```bash
gh issue create \
  --title "Bug: Description" \
  --body "## Steps to Reproduce
1. Step 1
2. Step 2

## Expected Behavior

## Actual Behavior
" \
  --label bug
```

### Create PR with Template
```bash
gh pr create \
  --title "feat: add feature" \
  --body "## Description
Implements X feature.

## Related Issue
Fixes #123

## Testing
- [ ] Unit tests
- [ ] Integration tests
" \
  --draft
```

### Auto-Merge PR
```bash
# Enable auto-merge (will merge when checks pass)
gh pr merge --auto --squash --delete-branch
```

## For detailed command reference, see [COMMANDS.md](COMMANDS.md).
