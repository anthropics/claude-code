---
name: neon-branching
description: >
  Use when the user asks to "create a preview branch", "set up database branching",
  "configure Neon + Vercel", "create a Neon branch for this PR", "delete preview branch",
  "reset dev branch", "show schema diff", or discusses database-per-branch workflows.
  Manages Neon Postgres branches aligned to Git branches with Vercel preview deployments.
version: 1.0.0
user-invocable: true
argument-hint: <create|delete|reset|diff|setup> [--branch <name>]
allowed-tools:
  - Bash
  - Read
  - Write
  - Edit
  - Glob
  - Grep
  - mcp__plugin_neon-vercel-branching_neon__create_project
  - mcp__plugin_neon-vercel-branching_neon__list_projects
  - mcp__plugin_neon-vercel-branching_neon__create_branch
  - mcp__plugin_neon-vercel-branching_neon__list_branches
  - mcp__plugin_neon-vercel-branching_neon__delete_branch
  - mcp__plugin_neon-vercel-branching_neon__get_connection_uri
  - mcp__plugin_neon-vercel-branching_neon__run_sql
  - mcp__plugin_neon-vercel-branching_neon__describe_table_schema
---

# Neon Database Branching Skill

Manage Neon Postgres branches that mirror your Git branches. Each PR gets an
isolated database branch; merging or closing the PR deletes it automatically.

## Architecture

```
main branch ──────────────────────────────────────► production
  │                                                   │
  ├── PR #42 ──► preview/pr-42 (Neon) ──────────────► Vercel preview
  │                 DATABASE_URL injected at build
  │
  ├── PR #43 ──► preview/pr-43 (Neon) ──────────────► Vercel preview
  │
  └── dev    ──► dev (Neon, reset on main push) ────► local dev
```

## Commands

### `create` — Create a Neon branch for the current Git branch

1. Detect the current Git branch name
2. Use the Neon MCP server to create a branch named `preview/<branch-name>`
3. Retrieve the connection string via `get_connection_uri`
4. Output the `DATABASE_URL` for the user to add to their `.env.local`

```bash
# The GitHub Actions workflow (neon-vercel-preview.yml) does this automatically
# for PRs. This command is for local development.
```

### `delete` — Delete a Neon branch

1. Detect the current Git branch or accept `--branch <name>`
2. Use the Neon MCP server to delete the branch
3. Confirm deletion

### `reset` — Reset dev branch to match production

1. Use the Neon MCP server to get the default (production) branch
2. Delete and recreate the `dev` branch from the default branch
3. Output the new connection string

### `diff` — Show schema differences

1. Use `describe_table_schema` on both the current branch and `main`
2. Compare and display differences
3. Highlight added/removed/modified columns and tables

### `setup` — First-time setup for a repository

1. Check for `NEON_API_KEY` environment variable
2. Check for `NEON_PROJECT_ID` environment variable or use MCP to list projects
3. Verify GitHub secrets are configured (via `gh secret list`)
4. Validate the three workflow files exist:
   - `.github/workflows/neon-vercel-preview.yml`
   - `.github/workflows/neon-vercel-cleanup.yml`
   - `.github/workflows/neon-vercel-production.yml`
5. Test Neon connectivity via MCP
6. Report setup status

## GitHub Actions Workflows

This skill works in tandem with three GitHub Actions workflows:

| Workflow | Trigger | Action |
|----------|---------|--------|
| `neon-vercel-preview.yml` | PR open/sync | Creates Neon branch, deploys Vercel preview with `DATABASE_URL` |
| `neon-vercel-cleanup.yml` | PR close | Deletes Neon preview branch |
| `neon-vercel-production.yml` | Push to main | Resets dev branch, deploys Vercel production |

For full workflow details, see `guides/workflow-reference.md`.

## Neon Branch Naming Convention

| Git Context | Neon Branch Name | Lifecycle |
|-------------|-----------------|-----------|
| PR #N | `preview/pr-<N>` | Created on PR open, deleted on PR close |
| `dev` branch | `dev` | Persistent, reset on main push |
| `main` branch | (default branch) | Production, never modified directly |
| Feature branch (local) | `preview/<branch-name>` | Created manually, deleted manually |

## Required Secrets & Variables

Configure these in GitHub repository settings:

| Name | Type | Source |
|------|------|--------|
| `NEON_API_KEY` | Secret | [Neon Console → API Keys](https://console.neon.tech/app/settings/api-keys) |
| `NEON_PROJECT_ID` | Variable | [Neon Console → Settings](https://console.neon.tech) |
| `VERCEL_TOKEN` | Secret | [Vercel → Account Settings → Tokens](https://vercel.com/account/tokens) |
| `VERCEL_ORG_ID` | Secret | `vercel link` → `.vercel/project.json` |
| `VERCEL_PROJECT_ID` | Secret | `vercel link` → `.vercel/project.json` |

## Connection String Injection

The preview workflow injects two environment variables into the Vercel build:

- `DATABASE_URL` — Direct connection (for migrations, admin tasks)
- `DATABASE_URL_POOLED` — Pooled connection (for app runtime, serverless)

Your application should use `DATABASE_URL_POOLED` for runtime queries and
`DATABASE_URL` for migrations:

```typescript
// drizzle.config.ts
export default {
  dbCredentials: {
    url: process.env.DATABASE_URL!,  // direct — for migrations
  },
};

// src/db.ts
import { neon } from '@neondatabase/serverless';
const sql = neon(process.env.DATABASE_URL_POOLED!);  // pooled — for runtime
```

## Troubleshooting

### "Branch already exists"
The `create-branch-action` is idempotent — if a branch with the same name
exists, it returns the existing branch. No action needed.

### "Branch not found" on delete
The branch may have already been deleted (e.g., manual cleanup). The
`delete-branch-action` handles this gracefully.

### Schema diff shows no changes
Ensure your migration has been applied to the preview branch. The diff
compares the actual schema, not migration files.
