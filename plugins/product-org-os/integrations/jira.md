# Jira Integration

## What It Enables

| Agent | Capabilities |
|-------|-------------|
| @pm | Create issues from /user-story and /feature-spec output, update issue status |
| @pm-dir | View sprint boards, track roadmap delivery progress |
| @prod-ops | Monitor launch readiness, track cross-team dependencies |
| @bizops | Pull velocity and delivery metrics |

## MCP Server

- **Package**: `@anthropic/mcp-atlassian` or `@xuandev/atlassian-mcp`
- **Protocol**: MCP over stdio
- **Source**: Check npmjs.com for latest Jira MCP packages

## Setup

### 1. Install

```bash
npm install -g @anthropic/mcp-atlassian
```

### 2. Configure `.mcp.json`

```json
{
  "mcpServers": {
    "jira": {
      "command": "npx",
      "args": ["@anthropic/mcp-atlassian"],
      "env": {
        "JIRA_URL": "https://your-domain.atlassian.net",
        "JIRA_EMAIL": "your-email@company.com",
        "JIRA_API_TOKEN": "your-api-token"
      }
    }
  }
}
```

### 3. Get API Token

1. Go to https://id.atlassian.com/manage-profile/security/api-tokens
2. Create a new API token
3. Add to your `.mcp.json` configuration

### 4. Verify

Ask your AI assistant: "List my Jira projects" — if the MCP server is connected, you'll see your projects.

## Agent Workflows

### PM Creating User Stories
When @pm runs `/user-story`, with Jira connected:
- Stories are created directly in the configured project
- Acceptance criteria populate the description field
- Story points are set if provided

### PM-Dir Tracking Roadmap
When @pm-dir reviews roadmap progress:
- Pulls actual sprint data and velocity
- Shows blockers from real issue statuses
- Maps roadmap themes to epics

### ProdOps Launch Coordination
When @prod-ops runs `/launch-readiness`:
- Checks real issue statuses for launch blockers
- Verifies all launch tasks are complete
- Links to actual tickets for action items
