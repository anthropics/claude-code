---
name: Neon Toolkit
description: This skill should be used when the user wants to "create a Neon branch", "manage Neon projects", "use the Neon API", "create an ephemeral database", "reset a database branch", "list Neon endpoints", or needs guidance on programmatic Neon project/branch/database management via the Neon Management API.
version: 0.1.0
---

# Neon Toolkit — API & Branch Management

Manage Neon projects, branches, databases, and endpoints programmatically using the Neon Management API.

## When to Use

- Creating or managing Neon branches for preview environments
- Automating database provisioning in CI/CD pipelines
- Programmatically creating ephemeral databases for testing
- Managing Neon projects and endpoints via API
- Resetting branches to match production data

## API Authentication

All Neon API requests require an API key:

```bash
# Set in environment
export NEON_API_KEY="your-api-key"

# Or use in requests
curl -H "Authorization: Bearer $NEON_API_KEY" \
  https://console.neon.tech/api/v2/projects
```

Create an API key at: https://console.neon.tech/app/settings/api-keys

## Branch Operations

### Create a Branch

```bash
curl -X POST "https://console.neon.tech/api/v2/projects/$NEON_PROJECT_ID/branches" \
  -H "Authorization: Bearer $NEON_API_KEY" \
  -H "Content-Type: application/json" \
  -d '{
    "branch": {
      "name": "preview/pr-42",
      "parent_id": "br-main-abc123"
    },
    "endpoints": [{
      "type": "read_write"
    }]
  }'
```

Via GitHub Actions:
```yaml
- uses: neondatabase/create-branch-action@v5
  with:
    project_id: ${{ vars.NEON_PROJECT_ID }}
    branch_name: preview/pr-${{ github.event.pull_request.number }}
    api_key: ${{ secrets.NEON_API_KEY }}
```

### Delete a Branch

```bash
curl -X DELETE \
  "https://console.neon.tech/api/v2/projects/$NEON_PROJECT_ID/branches/$BRANCH_ID" \
  -H "Authorization: Bearer $NEON_API_KEY"
```

Via GitHub Actions:
```yaml
- uses: neondatabase/delete-branch-action@v3
  with:
    project_id: ${{ vars.NEON_PROJECT_ID }}
    branch: preview/pr-${{ github.event.pull_request.number }}
    api_key: ${{ secrets.NEON_API_KEY }}
```

### Reset a Branch

Reset a branch to the latest state of its parent:

```bash
curl -X POST \
  "https://console.neon.tech/api/v2/projects/$NEON_PROJECT_ID/branches/$BRANCH_ID/reset" \
  -H "Authorization: Bearer $NEON_API_KEY" \
  -H "Content-Type: application/json" \
  -d '{"source_branch_id": "br-main-abc123"}'
```

### List Branches

```bash
curl "https://console.neon.tech/api/v2/projects/$NEON_PROJECT_ID/branches" \
  -H "Authorization: Bearer $NEON_API_KEY"
```

## Project Operations

### Create a Project

```bash
curl -X POST "https://console.neon.tech/api/v2/projects" \
  -H "Authorization: Bearer $NEON_API_KEY" \
  -H "Content-Type: application/json" \
  -d '{
    "project": {
      "name": "my-app",
      "region_id": "aws-us-east-2",
      "pg_version": 16
    }
  }'
```

### Get Connection String

```bash
curl "https://console.neon.tech/api/v2/projects/$NEON_PROJECT_ID/connection_uri" \
  -H "Authorization: Bearer $NEON_API_KEY" \
  --data-urlencode "role_name=neondb_owner" \
  --data-urlencode "database_name=neondb" \
  --data-urlencode "pooled=true"
```

## Branching Patterns

### Preview Branches (PR-based)

One Neon branch per pull request for isolated preview environments:

```
main (Neon) ──┬── preview/pr-42 (created on PR open)
              ├── preview/pr-43
              └── preview/pr-44  (deleted on PR close)
```

### Dev/Staging Branches

Long-lived branches for shared environments:

```
main (Neon) ──┬── dev      (reset weekly from main)
              └── staging  (reset before each release)
```

### Ephemeral Test Branches

Short-lived branches for CI test runs:

```bash
# In CI pipeline:
BRANCH=$(curl -s -X POST ".../branches" -d '{"branch":{"name":"ci-'$GITHUB_RUN_ID'"}}' ...)
# ... run tests against branch ...
curl -s -X DELETE ".../branches/$BRANCH_ID" ...
```

## MCP Server Integration

The Neon MCP Server enables natural language database management from Claude:

```json
{
  "mcpServers": {
    "neon": {
      "command": "npx",
      "args": ["-y", "@neondatabase/mcp-server-neon"],
      "env": {
        "NEON_API_KEY": "your-api-key"
      }
    }
  }
}
```

With MCP, Claude can:
- Create and delete branches
- Run SQL queries
- Manage projects and databases
- Inspect schema and data

## Neon CLI

For local development, use the Neon CLI:

```bash
# Install
npm install -g neonctl

# Authenticate
neonctl auth

# List projects
neonctl projects list

# Create a branch
neonctl branches create --project-id $NEON_PROJECT_ID --name my-branch

# Get connection string
neonctl connection-string --project-id $NEON_PROJECT_ID --branch-name my-branch

# Delete a branch
neonctl branches delete my-branch --project-id $NEON_PROJECT_ID
```

## Validation Checklist

- [ ] `NEON_API_KEY` set and has correct permissions
- [ ] `NEON_PROJECT_ID` configured
- [ ] Branch naming convention follows `preview/pr-{number}` pattern
- [ ] Cleanup workflow deletes branches on PR close
- [ ] Schema diff runs before merge to catch migration issues
- [ ] Connection strings use pooled endpoint for application access
- [ ] API calls include error handling and retries
