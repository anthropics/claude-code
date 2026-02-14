---
name: Feature Branch
about: Standard feature, bugfix, or enhancement PR
labels: feature
---

## Summary

<!-- 1-3 sentences: what does this PR do and why? -->

## Neon Database Branch

| Field | Value |
|-------|-------|
| **Neon Branch** | `preview/pr-<NUMBER>` |
| **Branch Status** | Created automatically by `neon-vercel-preview.yml` |
| **Schema Changes** | <!-- Yes / No --> |

<!-- If schema changes: the schema-diff-action will post a comment below. -->

## Changes

<!-- Bulleted list of what changed -->

-
-
-

## How to Test

1. Open the **Vercel preview URL** posted by the bot comment below
2. Verify the feature works against the isolated Neon branch
3. Check the **schema diff** comment (if applicable)

<!-- For local testing against the preview branch database: -->
```bash
# Copy DATABASE_URL from the bot comment or Neon Console
echo 'DATABASE_URL=postgresql://...' >> .env.local
npm run dev
```

## Database Migration Checklist

<!-- Check all that apply -->

- [ ] No schema changes in this PR
- [ ] Migration files added (`drizzle/migrations/` or `prisma/migrations/`)
- [ ] Migration tested locally against a Neon branch
- [ ] Rollback path documented (if destructive migration)
- [ ] `DATABASE_URL` (direct) used for migrations, `DATABASE_URL_POOLED` for runtime

## Deployment Checklist

- [ ] Vercel preview build passes
- [ ] E2E tests pass on preview deployment
- [ ] Schema diff reviewed (no unexpected changes)
- [ ] No secrets or credentials in code
- [ ] PR description is complete

## Related

<!-- Issues, other PRs, docs, Slack threads -->

- Closes #
