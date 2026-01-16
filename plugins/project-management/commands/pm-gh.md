---
description: GitHub CLI operations - issues, PRs, workflows, releases via gh command
allowed-tools: Bash(gh:*)
argument-hint: issue [list|create|view|close] | pr [list|create|checks|merge] | run [list|view|watch] | release [list|create]
---

# GitHub CLI Operations

## Prerequisites Check

- **gh version**: !`gh --version 2>/dev/null | head -1 || echo "gh not installed"`
- **Auth status**: !`gh auth status 2>&1 | head -3 || echo "Not authenticated"`
- **Current repo**: !`gh repo view --json nameWithOwner -q .nameWithOwner 2>/dev/null || echo "No repo context"`

## Command: $1 $2

### Operations

**If `issue`**:

```bash
# List open issues
gh issue list

# Create issue
gh issue create --title "Title" --body "Body"

# View issue
gh issue view <number>

# Close issue
gh issue close <number>
```

**If `pr`**:

```bash
# List open PRs
gh pr list

# Create PR
gh pr create --draft --title "Title" --body "Fixes #issue"

# Check CI status
gh pr checks

# Merge PR
gh pr merge --squash --delete-branch
```

**If `run`**:

```bash
# List workflow runs
gh run list

# View run details
gh run view

# Watch run in progress
gh run watch
```

**If `release`**:

```bash
# List releases
gh release list

# Create release
gh release create v1.0.0 --generate-notes
```

## Quick Reference

| Operation | Command |
|-----------|---------|
| List issues | `gh issue list` |
| Create issue | `gh issue create -t "Title" -b "Body"` |
| List PRs | `gh pr list` |
| Create draft PR | `gh pr create --draft` |
| PR status | `gh pr status` |
| PR checks | `gh pr checks` |
| Mark PR ready | `gh pr ready` |
| Approve PR | `gh pr review --approve` |
| Merge PR | `gh pr merge --squash` |
| Auto-merge | `gh pr merge --auto --squash` |
| List runs | `gh run list` |
| Watch run | `gh run watch` |

## Issue-PR Linking

When creating PR, use these keywords in body:
- `Fixes #123` - Auto-closes issue on merge
- `Closes #123` - Same as Fixes
- `Refs #123` - Links without closing

## Output Formatting

For programmatic output:
```bash
gh issue list --json number,title,state
gh pr list --json number,title,mergeable
```

## Arguments

- `$1`: Category (issue, pr, run, release)
- `$2`: Action (list, create, view, etc.)
- `$3+`: Additional arguments

## Error Handling

If `gh` not installed:
```bash
# macOS
brew install gh

# Ubuntu/Debian
apt install gh

# Other
https://cli.github.com/
```

If not authenticated:
```bash
gh auth login
```
