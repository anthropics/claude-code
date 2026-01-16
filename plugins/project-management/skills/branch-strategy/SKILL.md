---
name: branch-strategy
description: Branch naming conventions, lifecycle management, and branching strategies. Use when creating branches, discussing branch organization, or planning feature development.
---

# Branch Strategy Guide

This skill provides guidance on branch naming, organization, and lifecycle management.

## Branch Naming Convention

### Format
```
<type>/<issue-number>-<short-description>
```

### Types

| Type | Purpose | Example |
|------|---------|---------|
| `feature` | New functionality | `feature/123-user-login` |
| `fix` | Bug fixes | `fix/456-null-check` |
| `hotfix` | Urgent production fixes | `hotfix/789-security-vuln` |
| `refactor` | Code restructuring | `refactor/101-extract-utils` |
| `docs` | Documentation | `docs/102-api-docs` |
| `test` | Test additions | `test/103-auth-tests` |
| `chore` | Maintenance | `chore/104-deps-update` |
| `ci` | CI/CD changes | `ci/105-github-actions` |

### Rules

1. **Lowercase**: All lowercase letters
2. **Hyphen-separated**: Use hyphens, not underscores
3. **Issue reference**: Include issue number
4. **Concise**: Keep description short but meaningful
5. **No special chars**: Avoid `/`, `\`, spaces, `..`

## Branching Strategies

### Trunk-Based Development (Recommended for small teams)

**Characteristics:**
- Short-lived feature branches (< 1 day ideal)
- Frequent integration to main
- Feature flags for incomplete features
- CI/CD essential

### Git Flow (For release cycles)

**Branches:**
- `main`: Production releases
- `develop`: Integration branch
- `feature/*`: Feature development
- `release/*`: Release preparation
- `hotfix/*`: Production fixes

### GitHub Flow (Simple, CI/CD focused)

**Rules:**
- `main` is always deployable
- Feature branches from main
- PRs for all changes
- Deploy after merge

## Protected Branches

### Always Protect
- `main`
- `master`
- `develop`
- `production`
- `staging`

### Protection Rules
- Require PR reviews
- Require status checks
- No force pushes
- No deletions

## Best Practices

1. **Short-lived branches**: Merge within days, not weeks
2. **Sync frequently**: Rebase onto main daily
3. **Delete after merge**: Keep repository clean
4. **One purpose**: Each branch addresses one issue
5. **CI on branches**: Test before merge
