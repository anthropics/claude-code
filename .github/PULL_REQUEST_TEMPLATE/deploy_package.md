---
name: Deploy Package
about: Pull request for a deploy/release package targeting production
---

## Release Summary

<!-- What is being deployed? Version number if applicable. -->

**Version:** <!-- e.g., v1.2.0 -->
**Target:** `main` → Production (Vercel + Neon)

## Included Changes

<!-- List PRs or commits included in this deploy package -->

| PR | Title | Status |
|----|-------|--------|
| #  |       | Merged |

## Infrastructure Changes

### Vercel

- [ ] No Vercel configuration changes
- [ ] `vercel.json` modified
- [ ] Environment variables added/changed
- [ ] Build settings updated
- [ ] Domain/routing changes

### Neon Database

- [ ] No database changes
- [ ] Schema migration(s) included
- [ ] New indexes added
- [ ] Data migration required
- [ ] Branch reset needed post-deploy

### Environment Variables

<!-- List any new or changed environment variables -->

| Variable | Action | Where |
|----------|--------|-------|
| _none_   |        |       |

## Deployment Sequence

<!-- The production workflow (`vercel-production.yml`) handles
     the standard flow. Document any manual steps here. -->

1. Merge this PR to `main`
2. `vercel-production.yml` triggers automatically:
   - Pulls production environment
   - Builds with production `DATABASE_URL`
   - Deploys prebuilt to Vercel production
3. Post-deploy verification (see checklist below)

### Pre-Deploy Steps

<!-- Manual steps required BEFORE merging -->

- [ ] No pre-deploy steps required
- [ ] Database migration run manually: _describe_
- [ ] Environment variables set in Vercel dashboard
- [ ] Neon branch reset (`neon-branch-reset.yml`): _branch name_

### Post-Deploy Steps

<!-- Manual steps required AFTER merging -->

- [ ] No post-deploy steps required
- [ ] Cache purge needed
- [ ] DNS update required
- [ ] External service notification

## Rollback Plan

<!-- How to revert if something goes wrong -->

- **Vercel:** Automatic rollback — revert commit on `main`, previous deployment is restored instantly
- **Neon:** _describe database rollback strategy if migrations are included_

## Verification Checklist

- [ ] All included PRs passed CI
- [ ] Schema diff reviewed (no unexpected changes)
- [ ] Preview deployments tested for all included PRs
- [ ] Staging/dev branch tested (if applicable)
- [ ] Production environment variables confirmed
- [ ] On-call team notified (if off-hours deploy)
- [ ] Monitoring dashboards bookmarked for post-deploy watch
