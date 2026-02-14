---
name: neon-branch-workflow
description: >-
  Manages Neon database branches in sync with Git branches and Vercel preview
  deployments. Automatically creates isolated database environments for every
  feature branch, runs schema diffs on PRs, and cleans up on merge/close.
  Integrates with GitHub Actions workflows for full automation.
license: MIT
compatibility: Requires NEON_API_KEY secret and NEON_PROJECT_ID variable in GitHub repo settings.
metadata:
  author: jadecli-experimental
  version: 0.1.0
  category: database
  tags: neon, postgres, branching, vercel, preview, ci-cd
allowed-tools: Bash(neon:*) Bash(gh:*) Bash(vercel:*) Read
---

# Neon Branch Workflow

Manage Neon Serverless Postgres branches in lockstep with Git branches and
Vercel preview deployments.

## When to Use This Skill

Activate this skill when:

1. **Creating a new feature branch** — auto-create a matching Neon database
   branch forked from production
2. **Opening a pull request** — trigger Vercel preview deployment with the
   Neon branch's `DATABASE_URL` injected at build time
3. **Reviewing schema changes** — run Neon schema diff between the PR branch
   and base branch, posted as a PR comment
4. **Closing/merging a PR** — auto-delete the ephemeral Neon branch
5. **Resetting a dev branch** — reset a Neon branch to its parent's latest
   state (refresh with production data)

## Architecture

```
Git Branch Created ──► GitHub Action ──► Neon: Create Branch
                                          (fork from production)
                                          │
PR Opened/Updated ──► GitHub Action ──► Neon: Create Preview Branch
                                       Vercel: Build + Deploy
                                       Neon: Schema Diff → PR Comment
                                          │
PR Closed/Merged ──► GitHub Action ──► Neon: Delete Branch
                                       Vercel: Expire Preview
```

### Branch Naming Convention

| Git Branch | Neon Branch | Purpose |
|------------|-------------|---------|
| `claude/{feature}-{session}` | `claude/{feature}-{session}` | Feature development |
| — | `preview/pr-{number}` | PR preview environment |
| `main` | Primary branch (production) | Production database |

## Quick Start

### Prerequisites

1. **Neon project** — Create at [console.neon.tech](https://console.neon.tech)
2. **GitHub secrets** — Add to repo Settings → Secrets:
   - `NEON_API_KEY` — From Neon console → Account → API Keys
   - `VERCEL_TOKEN` — From Vercel dashboard → Settings → Tokens
   - `VERCEL_ORG_ID` — From `.vercel/project.json`
   - `VERCEL_PROJECT_ID` — From `.vercel/project.json`
3. **GitHub variable** — Add to repo Settings → Variables:
   - `NEON_PROJECT_ID` — From Neon console → Project Settings

### Install Neon MCP Server (for Claude Code)

The MCP server lets Claude interact with Neon's API directly:

```bash
# Via Claude Code plugin
/plugin install neon-branching

# Or manually — the .mcp.json in this plugin configures it
```

Once connected, Claude can:
- Create/delete/list Neon branches
- Run SQL queries against any branch
- Check branch status and connection strings
- Compare schemas between branches

### GitHub Actions (automatic)

Three workflows in `.github/workflows/` handle the full lifecycle:

| Workflow | Trigger | Action |
|----------|---------|--------|
| `branch-neon-sync.yml` | Branch create | Create Neon branch |
| `preview-deploy.yml` | PR open/push | Neon branch + Vercel deploy |
| `preview-cleanup.yml` | PR close | Delete Neon branch |

These are already configured — just add the secrets and they activate.

## Manual Operations

### Create a Neon branch manually

```bash
# Via Neon CLI
neonctl branches create \
  --project-id $NEON_PROJECT_ID \
  --name "claude/my-feature-abc123" \
  --parent main

# Via GitHub Actions (manual dispatch)
gh workflow run branch-neon-sync.yml \
  -f branch_name="claude/my-feature-abc123" \
  -f action=create
```

### Reset a branch to production state

```bash
# Via Neon CLI
neonctl branches reset \
  --project-id $NEON_PROJECT_ID \
  --name "claude/my-feature-abc123"

# Via GitHub Actions
gh workflow run branch-neon-sync.yml \
  -f branch_name="claude/my-feature-abc123" \
  -f action=reset
```

### Delete a branch

```bash
neonctl branches delete \
  --project-id $NEON_PROJECT_ID \
  --name "preview/pr-42"
```

### Get connection string

```bash
neonctl connection-string \
  --project-id $NEON_PROJECT_ID \
  --branch "claude/my-feature-abc123" \
  --pooled
```

## Integration with Deterministic Process

When starting a new extraction:

1. `branch-neon-sync.yml` auto-creates a Neon branch when you push
   `claude/{feature}-{session}`
2. The Neon branch provides an isolated database for any data persistence
   needed during extraction
3. On PR, `preview-deploy.yml` creates a Vercel preview with the database
   connected
4. `animated-workflow-viz` renders the CI/CD pipeline status:
   ```bash
   node skills/animated-workflow-viz/scripts/render-workflow.mjs \
     --template neon-vercel-cicd --static
   ```
5. On merge, `preview-cleanup.yml` deletes the ephemeral Neon branch

## Visualize the CI/CD Pipeline

```bash
# Animated terminal rendering
node skills/animated-workflow-viz/scripts/render-workflow.mjs \
  --template neon-vercel-cicd

# Static rendering
node skills/animated-workflow-viz/scripts/render-workflow.mjs \
  --template neon-vercel-cicd --static
```

## References

- [Neon Branching Docs](https://neon.tech/docs/introduction/branching)
- [Neon GitHub Actions](https://neon.tech/docs/guides/branching-github-actions)
- [Neon Agent Skills](https://github.com/neondatabase/agent-skills)
- [Vercel GitHub Integration](https://vercel.com/docs/deployments/git/vercel-for-github)
- [Neon MCP Server](https://mcp.neon.tech)
