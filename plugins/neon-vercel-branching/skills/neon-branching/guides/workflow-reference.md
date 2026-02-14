# GitHub Actions Workflow Reference

## Preview Workflow (`neon-vercel-preview.yml`)

**Trigger:** `pull_request: [opened, synchronize, reopened]`

### Job: `neon-branch`
Creates a Neon database branch from the project's default branch (main).

- **Action:** `neondatabase/create-branch-action@v5`
- **Branch name:** `preview/pr-<PR number>`
- **Outputs:** `db_url`, `db_url_with_pooler`, `branch_id`
- **Idempotent:** Re-running on the same PR reuses the existing branch

### Job: `schema-diff`
Compares the preview branch schema against main and posts a PR comment.

- **Action:** `neondatabase/schema-diff-action@v1`
- **Depends on:** `neon-branch`

### Job: `vercel-preview`
Builds and deploys a Vercel preview with the Neon branch's connection string.

- **Depends on:** `neon-branch`
- **Build env:** `DATABASE_URL`, `DATABASE_URL_POOLED`, `NEON_BRANCH_ID`, `NEON_BRANCH_NAME`
- **Deploy:** `vercel deploy --prebuilt`
- **PR comment:** Upserts a comment with the preview URL and Neon branch ID

### Concurrency
- Group: `preview-<PR number>`
- Cancels in-progress builds for the same PR on new pushes

---

## Cleanup Workflow (`neon-vercel-cleanup.yml`)

**Trigger:** `pull_request: [closed]`

### Job: `delete-neon-branch`
Deletes the Neon preview branch when the PR is closed (merged or abandoned).

- **Action:** `neondatabase/delete-branch-action@v3`
- **Branch name:** `preview/pr-<PR number>`
- Vercel automatically deactivates the preview deployment

---

## Production Workflow (`neon-vercel-production.yml`)

**Trigger:** `push: branches: [main]`

### Job: `neon-reset`
Resets the Neon `dev` branch to match the production (default) branch.

- **Action:** `neondatabase/reset-branch-action@v1`
- **Branch:** `dev`
- **Continue on error:** Yes (skips if dev branch doesn't exist yet)

### Job: `vercel-production`
Builds and deploys to Vercel production.

- **Deploy:** `vercel deploy --prebuilt --prod`

### Concurrency
- Group: `production`
- Never cancels in-progress production deploys

---

## Required GitHub Configuration

### Secrets (Settings → Secrets → Actions)

| Secret | Description |
|--------|-------------|
| `NEON_API_KEY` | Neon API key for branch management |
| `VERCEL_TOKEN` | Vercel deployment token |
| `VERCEL_ORG_ID` | Vercel organization ID |
| `VERCEL_PROJECT_ID` | Vercel project ID |

### Variables (Settings → Variables → Actions)

| Variable | Description |
|----------|-------------|
| `NEON_PROJECT_ID` | Neon project ID (plaintext, not secret) |

### Neon GitHub Integration (Alternative)

Instead of manually adding secrets, use the
[Neon GitHub Integration](https://neon.tech/docs/guides/neon-github-integration)
which automatically creates `NEON_API_KEY` secret and `NEON_PROJECT_ID` variable.
