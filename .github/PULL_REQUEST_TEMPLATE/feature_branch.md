---
name: Feature Branch
about: Pull request for a feature branch (new feature, enhancement, or bug fix)
---

## Summary

<!-- 1-3 sentences describing what this PR does and why -->

## Type of Change

<!-- Check the relevant option -->

- [ ] New feature
- [ ] Enhancement to existing feature
- [ ] Bug fix
- [ ] Refactor (no functional change)
- [ ] Documentation

## Changes

<!-- Bulleted list of key changes -->

-

## Database Changes

<!-- If this PR includes schema/migration changes, they will be
     automatically diffed by the `neon-schema-diff` workflow.
     Check the PR comments for the diff after CI runs. -->

- [ ] No database changes
- [ ] New migration added (`drizzle/` or `migrations/`)
- [ ] Schema modified (`db/schema.ts`)
- [ ] Seed data updated

## Preview Deployment

<!-- Automatically populated by neon-vercel-preview workflow -->

| Resource | Status |
|----------|--------|
| Vercel Preview | _Pending CI..._ |
| Neon Branch | `preview/pr-{number}` |

## Test Plan

<!-- How was this tested? What should reviewers verify? -->

- [ ] Unit tests pass
- [ ] Preview deployment verified
- [ ] Database migration tested on Neon branch
- [ ] Manual testing completed

## Checklist

- [ ] Code follows project conventions
- [ ] Self-review completed
- [ ] No secrets or credentials committed
- [ ] `.env` changes documented (if any)
- [ ] Breaking changes documented (if any)
