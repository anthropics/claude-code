## Feature Branch: `{FEATURE_NAME}`

> **Branch**: `claude/{feature-kebab}-{session-id}`
> **Neon Branch**: `claude/{feature-kebab}-{session-id}` (auto-created by `branch-neon-sync.yml`)
> **Preview URL**: <!-- auto-posted by preview-deploy.yml -->

---

### What This PR Does

<!-- 1-3 sentences describing the feature. Focus on the "why" not the "what". -->

---

### Infrastructure Checklist

#### Neon Database Branch

- [ ] **Neon branch created** — `branch-neon-sync.yml` created Neon branch on push
- [ ] **Schema diff clean** — Schema diff posted by `branch-neon-sync.yml` shows expected changes (or no changes)
- [ ] **No orphaned data** — Preview branch data is ephemeral and will be deleted on merge

#### Vercel Preview Deployment

- [ ] **Preview deployed** — `preview-deploy.yml` deployed preview with `DATABASE_URL` injected
- [ ] **Preview URL functional** — Preview loads correctly with isolated database
- [ ] **No production impact** — Preview branch does not affect production Neon branch

#### Code Changes

- [ ] **Feature implementation** — Core feature code complete
- [ ] **Tests pass** — All existing tests pass, new tests added where needed
- [ ] **No secrets committed** — `.env`, credentials, API keys not in diff
- [ ] **Self-contained** — No external CDN/fetch calls if generating static artifacts

---

### Conventional Commits

<!-- List the conventional commits in this PR, in order -->

| # | Type | Message |
|---|------|---------|
| 1 | `feat` | <!-- e.g. "add user authentication flow" --> |
| 2 | `test` | <!-- e.g. "validate auth token expiry" --> |
| 3 | `docs` | <!-- e.g. "update API reference" --> |

---

### Preview Environment

| Resource | Value |
|----------|-------|
| **Vercel Preview** | <!-- auto-filled by bot comment --> |
| **Neon Branch** | `claude/{feature-kebab}-{session-id}` |
| **Neon Branch ID** | <!-- auto-filled by bot comment --> |
| **Parent Branch** | `main` (production) |

### Schema Changes

<!-- If this PR modifies the database schema, describe the changes here.
     The schema-diff bot will post the full diff automatically. -->

- [ ] No schema changes
- [ ] Schema changes (described below)

```sql
-- Paste schema changes here, or reference the bot comment
```

---

### Neon + Vercel Lifecycle

```
git push claude/{feature}  ──►  branch-neon-sync.yml  ──►  Neon branch created
                                                               │
gh pr create               ──►  preview-deploy.yml    ──►  Vercel preview + Neon preview/pr-N
                                branch-neon-sync.yml  ──►  Schema diff posted
                                                               │
gh pr merge                ──►  preview-cleanup.yml   ──►  Neon branch deleted
                                Vercel                ──►  Production deploy
```

---

### Post-Merge Cleanup

- [ ] **Neon branch deleted** — `preview-cleanup.yml` will auto-delete on merge
- [ ] **Vercel preview expired** — Preview URL becomes inactive after merge
- [ ] **Production verified** — Production deployment successful after merge

---

*Workflows: [`preview-deploy.yml`](.github/workflows/preview-deploy.yml) | [`preview-cleanup.yml`](.github/workflows/preview-cleanup.yml) | [`branch-neon-sync.yml`](.github/workflows/branch-neon-sync.yml)*
