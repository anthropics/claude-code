## Deploy Package: `{PACKAGE_NAME}` → `{ENVIRONMENT}`

> **Branch**: `deploy/{package}-{environment}-{date}`
> **Environment**: `preview` | `staging` | `production`
> **Neon Branch**: `deploy/{package}-{environment}-{date}`
> **Vercel Project**: `{VERCEL_PROJECT_ID}`

---

### Deployment Summary

<!-- What is being deployed and why. 1-3 sentences. -->

---

### Package Manifest

| Property | Value |
|----------|-------|
| **Package** | `{PACKAGE_NAME}` |
| **Version** | `{VERSION}` |
| **Environment** | `preview` / `staging` / `production` |
| **Vercel Project** | <!-- project name or ID --> |
| **Neon Project** | <!-- project name or ID --> |
| **Includes migrations** | Yes / No |

---

### Pre-Deploy Checklist

#### Database (Neon)

- [ ] **Neon branch exists** — Deployment branch created by `branch-neon-sync.yml`
- [ ] **Schema diff reviewed** — Schema diff posted by bot, changes are expected
- [ ] **Migrations tested** — Migrations run successfully on preview Neon branch
- [ ] **Rollback plan** — Migration rollback SQL prepared (if applicable)
- [ ] **Data integrity** — No destructive migrations without backup confirmation

```sql
-- Migration summary (paste or reference migration files)
-- UP:
-- DOWN (rollback):
```

#### Application (Vercel)

- [ ] **Preview deployed** — `preview-deploy.yml` deployed preview successfully
- [ ] **Preview tested** — Manual or automated tests passed on preview URL
- [ ] **Environment variables** — All required env vars set for target environment
- [ ] **Build succeeds** — `vercel build` completes without errors
- [ ] **No external deps added** — No new CDN/external service dependencies

#### Verification

- [ ] **Smoke test** — Core user flows work on preview
- [ ] **API endpoints** — All API routes respond correctly
- [ ] **Database connectivity** — App connects to Neon branch successfully
- [ ] **Error monitoring** — Error tracking configured for deployment

---

### Environment Promotion Path

```
┌─────────────────────────────────────────────────────────────────┐
│                                                                 │
│   preview/pr-N          staging               production        │
│   ┌──────────┐          ┌──────────┐          ┌──────────┐     │
│   │  Vercel  │ ──────►  │  Vercel  │ ──────►  │  Vercel  │     │
│   │  Preview │  merge   │  Staging │  merge   │   Prod   │     │
│   └──────────┘          └──────────┘          └──────────┘     │
│   ┌──────────┐          ┌──────────┐          ┌──────────┐     │
│   │   Neon   │          │   Neon   │          │   Neon   │     │
│   │  Branch  │ ──────►  │  Branch  │ ──────►  │   Main   │     │
│   │ (fork)   │  migrate │ (fork)   │  migrate │  (prod)  │     │
│   └──────────┘          └──────────┘          └──────────┘     │
│                                                                 │
└─────────────────────────────────────────────────────────────────┘
```

---

### Deploy Steps

#### 1. Preview (automated)
- [x] PR opened → `preview-deploy.yml` → Neon branch + Vercel preview
- [ ] Schema diff reviewed
- [ ] Preview URL tested

#### 2. Staging (manual gate)
- [ ] PR approved by reviewer
- [ ] Staging environment variables verified
- [ ] `vercel deploy --prebuilt --target staging` (or merge to staging branch)
- [ ] Migrations applied to staging Neon branch
- [ ] Staging smoke test passed

#### 3. Production (manual gate)
- [ ] Staging sign-off complete
- [ ] Production environment variables verified
- [ ] Merge to `main` → Vercel auto-deploys to production
- [ ] Migrations applied to production Neon branch
- [ ] Production smoke test passed
- [ ] Monitoring dashboards checked (5 min post-deploy)

---

### Rollback Plan

| Step | Action | Command |
|------|--------|---------|
| 1 | Revert Vercel | `vercel rollback` or revert commit on `main` |
| 2 | Rollback Neon | `neonctl branches reset --name main` or run DOWN migration |
| 3 | Verify | Check production URL + database state |

---

### Post-Deploy Verification

- [ ] **Production URL** responds with 200
- [ ] **Database** queries return expected results
- [ ] **No error spikes** in monitoring (first 15 min)
- [ ] **Neon preview branch deleted** by `preview-cleanup.yml`
- [ ] **Documentation updated** (if public-facing changes)

---

### Files Changed

| Category | Files |
|----------|-------|
| **Migrations** | <!-- e.g. db/migrations/001_add_users.sql --> |
| **Application** | <!-- e.g. src/api/users.ts --> |
| **Config** | <!-- e.g. vercel.json, .env.example --> |
| **Tests** | <!-- e.g. tests/api/users.test.ts --> |

---

*Workflows: [`preview-deploy.yml`](.github/workflows/preview-deploy.yml) | [`preview-cleanup.yml`](.github/workflows/preview-cleanup.yml) | [`branch-neon-sync.yml`](.github/workflows/branch-neon-sync.yml)*
