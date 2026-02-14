# Neon + Vercel Setup Reference

## Required GitHub Repository Configuration

### Secrets (Settings → Secrets and variables → Actions → Secrets)

| Secret | Source | Purpose |
|--------|--------|---------|
| `NEON_API_KEY` | [Neon Console → Account → API Keys](https://console.neon.tech/app/settings/api-keys) | Authenticate GitHub Actions with Neon API |
| `VERCEL_TOKEN` | [Vercel Dashboard → Settings → Tokens](https://vercel.com/account/tokens) | Authenticate GitHub Actions with Vercel |
| `VERCEL_ORG_ID` | `.vercel/project.json` → `orgId` | Identify Vercel team/org |
| `VERCEL_PROJECT_ID` | `.vercel/project.json` → `projectId` | Identify Vercel project |

### Variables (Settings → Secrets and variables → Actions → Variables)

| Variable | Source | Purpose |
|----------|--------|---------|
| `NEON_PROJECT_ID` | [Neon Console → Project → Settings](https://console.neon.tech) | Identify Neon project for branch operations |

## Workflow Files

### `preview-deploy.yml`

**Trigger**: `pull_request: [opened, synchronize, reopened]`

**Pipeline**:
1. Checkout code
2. Create Neon branch `preview/pr-{number}` (forked from production)
3. Install Vercel CLI
4. `vercel pull` — download environment config
5. `vercel build` — build with `DATABASE_URL` from Neon branch
6. `vercel deploy --prebuilt` — deploy to preview URL
7. Post PR comment with preview URL + Neon branch details

**Outputs**: Vercel preview URL, Neon branch ID

### `preview-cleanup.yml`

**Trigger**: `pull_request: [closed]`

**Pipeline**:
1. Delete Neon branch `preview/pr-{number}`
2. Post PR comment confirming cleanup

### `branch-neon-sync.yml`

**Trigger**: `create` (branch), `pull_request: [opened, synchronize]`, `workflow_dispatch`

**Pipeline (branch create)**:
1. Sanitize branch name for Neon compatibility
2. Create Neon branch matching Git branch name
3. Log to GitHub Actions step summary

**Pipeline (PR schema diff)**:
1. Compare Neon branches (head vs base)
2. Post schema diff as PR comment

**Pipeline (manual reset)**:
1. Reset Neon branch to parent's latest state

## Neon Branch Lifecycle

```
main (production)
  │
  ├── claude/feature-abc123     ← Created on `git push` (branch-neon-sync.yml)
  │     │
  │     └── preview/pr-42       ← Created on PR open (preview-deploy.yml)
  │           │
  │           └── [deleted]     ← Deleted on PR close (preview-cleanup.yml)
  │
  └── claude/feature-def456     ← Another feature branch
```

## Neon MCP Server

The `.mcp.json` configures the Neon MCP server for Claude Code:

```json
{
  "mcpServers": {
    "neon": {
      "command": "npx",
      "args": ["-y", "@neondatabase/mcp-server-neon"],
      "env": {
        "NEON_API_KEY": ""
      }
    }
  }
}
```

Set `NEON_API_KEY` in your environment or Claude Code settings before use.

**Available MCP tools**:
- `neon_list_projects` — List all Neon projects
- `neon_create_branch` — Create a branch
- `neon_delete_branch` — Delete a branch
- `neon_get_connection_string` — Get pooled connection string
- `neon_run_sql` — Execute SQL against a branch
- `neon_list_branches` — List branches in a project
- `neon_describe_branch` — Get branch details

## Vercel Environment Variables

The preview deployment injects these at build time:

| Variable | Value | Source |
|----------|-------|--------|
| `DATABASE_URL` | Neon pooled connection string | `neon-branch.outputs.db_url_with_pooler` |
| `VERCEL_GIT_COMMIT_REF` | Git branch name | Vercel system |
| `VERCEL_GIT_PULL_REQUEST_ID` | PR number | Vercel system |

## Neon GitHub Actions Reference

| Action | Version | Purpose |
|--------|---------|---------|
| `neondatabase/create-branch-action` | `v5` | Create Neon branch |
| `neondatabase/delete-branch-action` | `v3` | Delete Neon branch |
| `neondatabase/reset-branch-action` | `v1` | Reset branch to parent |
| `neondatabase/schema-diff-action` | `v1` | Compare schemas, post PR comment |

All actions accept `project_id` and `api_key` as required inputs.
