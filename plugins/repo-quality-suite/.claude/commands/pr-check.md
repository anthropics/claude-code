---
description: Validate a pull request for merge readiness, conflicts, and code quality
allowed-tools: Bash(git:*), Bash(gh:*), Bash(glab:*), Bash(ruff:*), Bash(cargo:*), Bash(npx:*), Bash(jq:*), Read, Glob, Grep, TodoWrite, mcp__github__*, mcp__gitlab__*, mcp__bitbucket__*
argument-hint: [pr-number|pr-range] [--platform=github|gitlab|bitbucket] [--base=main]
---

# Pull Request Validation Assistant

You are a PR validation assistant. Your task is to check if a pull request is ready for merge.

## Arguments

Parse: $ARGUMENTS

- `pr-number`: Single PR number (e.g., 123)
- `pr-range`: Range of PRs (e.g., 100-110)
- `--platform`: github (default), gitlab, or bitbucket
- `--base`: Base branch for comparison (default: main)

## Current Context

- Current branch: !`git branch --show-current 2>/dev/null`
- Remote URL: !`git remote get-url origin 2>/dev/null || echo "no remote"`
- Recent commits: !`git log --oneline -5 2>/dev/null`

## Validation Checklist

Create a TODO list for each PR and validate:

### 1. Merge Compatibility
```bash
# Fetch latest base branch
git fetch origin <base-branch>

# Check if PR branch can be rebased cleanly
git merge-base --is-ancestor origin/<base-branch> HEAD

# Check for conflicts
git merge --no-commit --no-ff origin/<base-branch> 2>&1
git merge --abort 2>/dev/null || true
```

### 2. Branch Divergence
```bash
# Commits ahead/behind base
git rev-list --left-right --count origin/<base-branch>...HEAD

# Check if base has moved since PR was created
git log origin/<base-branch> --oneline --since="PR created date" | head -10
```

### 3. Code Quality on Changed Files
```bash
# Get changed files
git diff --name-only origin/<base-branch>...HEAD

# Run linters only on changed files
# Python: ruff check <files>
# Rust: cargo clippy
# JS/TS: npx eslint <files>
```

### 4. PR Metadata (via API)

For GitHub:
```bash
gh pr view <number> --json title,body,labels,reviews,mergeable,mergeStateStatus
gh pr checks <number>
```

For GitLab:
```bash
glab mr view <number>
```

### 5. Commit Quality
```bash
# Check commit message format
git log origin/<base-branch>..HEAD --format="%s" | head -20

# Check for fixup/squash commits that should be cleaned
git log origin/<base-branch>..HEAD --format="%s" | grep -i "fixup\|squash\|wip"

# Check for merge commits (should typically be rebased)
git log origin/<base-branch>..HEAD --merges
```

## Output Format

For each PR checked, provide:

```
PR #<number>: <title>
├── Merge Status: ✓ Clean / ✗ Conflicts / ⚠ Needs rebase
├── Branch: <ahead> ahead, <behind> behind <base>
├── Code Quality:
│   ├── Python: X errors, Y warnings
│   ├── Rust: X errors, Y warnings
│   └── JS/TS: X errors, Y warnings
├── CI Status: ✓ Passing / ✗ Failing / ⚠ Pending
├── Reviews: X approved, Y changes requested
└── Recommendation: Ready to merge / Needs work
```

## Important

- Check PRs in parallel when validating a range
- Report blocking issues first
- Suggest specific actions to resolve issues
- Use MCP tools for API access when available
