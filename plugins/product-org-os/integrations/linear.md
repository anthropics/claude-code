# Linear Integration

## What It Enables

| Agent | Capabilities |
|-------|-------------|
| @pm | Create issues from /user-story and /feature-spec, manage cycles |
| @pm-dir | Track project progress, review roadmap delivery |
| @prod-ops | Monitor launch tasks, cross-team coordination |

## MCP Server

- **Package**: `@anthropic/mcp-linear` or community Linear MCP server
- **Protocol**: MCP over stdio

## Setup

### 1. Install

```bash
npm install -g @anthropic/mcp-linear
```

### 2. Configure `.mcp.json`

```json
{
  "mcpServers": {
    "linear": {
      "command": "npx",
      "args": ["@anthropic/mcp-linear"],
      "env": {
        "LINEAR_API_KEY": "your-linear-api-key"
      }
    }
  }
}
```

### 3. Get API Key

1. Go to Linear Settings > API > Personal API Keys
2. Create a new key with appropriate scopes
3. Add to your `.mcp.json`

### 4. Verify

Ask your AI assistant: "List my Linear teams" — you should see your workspace teams.

## Agent Workflows

### PM Creating Issues
When @pm creates user stories with Linear connected:
- Issues created in the configured team
- Labels auto-applied based on feature area
- Cycle assignment if sprint planning is active

### Roadmap Tracking
When checking roadmap progress:
- Projects map to roadmap themes
- Real completion percentages from issue statuses
- Blockers surfaced from actual issue labels
