## Deploy Package PR

> **Branch type:** `deploy/*` or `release/*`
> **Targets:** `main` (triggers production deployment)

### Release Summary

<!-- What is being deployed and why? Link to feature PRs. -->

| Field | Value |
|-------|-------|
| Package | `deterministic-object-usage/viz` |
| Version | <!-- e.g., 0.2.0 --> |
| Feature PRs | <!-- #123, #456 --> |
| Breaking changes | Yes / No |

### Pre-deploy Checklist

- [ ] All feature PRs merged and previews verified
- [ ] Neon primary branch schema matches expected state
- [ ] No pending migrations on ephemeral branches
- [ ] Environment variables configured in Vercel dashboard
- [ ] CHANGELOG.md updated with release notes

### Neon Database — Production

| Item | Details |
|------|---------|
| Project ID | `${{ NEON_PROJECT_ID }}` |
| Primary branch | `main` (production) |
| Migrations | _list or "none"_ |
| Rollback plan | _describe or "revert commit"_ |

<details>
<summary>Neon production flow on merge</summary>

```
Merge to main
  │
  ├─► neon-vercel-production.yml
  │    Production uses primary Neon branch directly.
  │    No ephemeral branch — DATABASE_URL comes from
  │    Vercel environment variables (set in dashboard).
  │
  │    ┌─────────────────────────────────┐
  │    │  Vercel Env Vars (production)   │
  │    │  DATABASE_URL          = pooled │
  │    │  DATABASE_URL_UNPOOLED = direct │
  │    └─────────────────────────────────┘
  │
  └─► All preview/pr-* branches eligible for cleanup
       (closed PRs trigger neon-branch-cleanup.yml)
```

</details>

### Vercel Deployment — Production

| Item | Details |
|------|---------|
| Working dir | `deterministic-object-usage/viz` |
| Path trigger | `deterministic-object-usage/viz/**` |
| Build mode | `--prod` |
| Node version | 22 |

<details>
<summary>Vercel production deployment flow</summary>

```
Push to main (matching paths)
  │
  ├─ vercel pull --environment=production
  │    Fetches production env vars + project settings
  │
  ├─ vercel build --prod
  │    NODE_ENV=production
  │    DATABASE_URL from Vercel dashboard (primary Neon branch)
  │    Output: .vercel/output/
  │
  └─ vercel deploy --prebuilt --prod
       Publishes to production domain
       Concurrency group: production-deploy (cancel-in-progress)
```

</details>

### Rollback Plan

<!-- How to roll back if production deploy fails. -->

1. **Vercel**: Instant rollback via Vercel dashboard (Deployments → Promote previous)
2. **Neon**: Restore from point-in-time recovery if schema migration fails
3. **Git**: `git revert <merge-commit>` → new PR → auto-deploys clean state

### Post-deploy Verification

- [ ] Production URL loads correctly
- [ ] Database connections healthy (pooled + unpooled)
- [ ] No console errors in browser
- [ ] API endpoint `/api/generate` responds
- [ ] Neon dashboard shows expected schema

### Ephemeral Branch Cleanup

<!-- After merge, these preview branches will be auto-deleted: -->

| PR | Neon Branch | Status |
|----|------------|--------|
| <!-- #123 --> | `preview/pr-123` | _auto-cleanup_ |
