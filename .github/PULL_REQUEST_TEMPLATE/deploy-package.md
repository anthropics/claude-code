---
name: Deploy Package
about: Infrastructure, workflow, or deployment configuration changes
labels: deploy, infrastructure
---

## Summary

<!-- What deployment/infra change does this PR make? -->

## Affected Workflows

<!-- Check all that apply -->

- [ ] `neon-vercel-preview.yml` — Preview deployment pipeline
- [ ] `neon-vercel-cleanup.yml` — Branch cleanup pipeline
- [ ] `neon-vercel-production.yml` — Production deployment pipeline
- [ ] `neon-vercel-e2e.yml` — E2E test pipeline
- [ ] Other: <!-- specify -->

## Neon Impact

| Field | Value |
|-------|-------|
| **Neon Branch Naming** | <!-- Changed / Unchanged --> |
| **Branch Lifecycle** | <!-- Changed / Unchanged --> |
| **Connection String Handling** | <!-- Changed / Unchanged --> |
| **MCP Server Config** | <!-- Changed / Unchanged --> |

## Vercel Impact

| Field | Value |
|-------|-------|
| **Build Configuration** | <!-- Changed / Unchanged --> |
| **Environment Variables** | <!-- Changed / Unchanged --> |
| **Deploy Targets** | <!-- Changed / Unchanged --> |
| **Concurrency Groups** | <!-- Changed / Unchanged --> |

## Changes

<!-- Bulleted list, organized by file -->

### Workflows
-

### Plugin (`plugins/neon-vercel-branching/`)
-

### Secrets / Variables
-

## Rollback Plan

<!-- How to revert if this breaks production -->

1.
2.

## Validation

### Pre-Merge

- [ ] Workflow YAML is valid (`actionlint` or manual review)
- [ ] GitHub Actions pinned to full commit SHAs (not mutable tags)
- [ ] No secrets exposed in workflow logs
- [ ] Concurrency groups preserve deploy safety
- [ ] `continue-on-error` only used intentionally

### Post-Merge

- [ ] Production deploy succeeds
- [ ] Neon `dev` branch resets correctly
- [ ] Next PR triggers preview pipeline correctly
- [ ] E2E tests run against preview deployment
- [ ] Cleanup deletes Neon branch on PR close

## Secret Changes

<!-- If any secrets/variables were added, changed, or removed -->

| Secret/Variable | Action | Where |
|-----------------|--------|-------|
| <!-- e.g. NEON_API_KEY --> | <!-- Added / Rotated / Removed --> | <!-- GitHub / Vercel / Both --> |

## Related

- Closes #
