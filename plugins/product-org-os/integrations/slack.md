# Slack Integration

## What It Enables

| Agent | Capabilities |
|-------|-------------|
| @prod-ops | Post launch updates, coordinate cross-team |
| @pmm | Share announcements, campaign updates |
| @pm-dir | Notify on roadmap changes, decision outcomes |
| @vp-product | Share strategic updates, portfolio decisions |

## MCP Server

- **Package**: `@modelcontextprotocol/server-slack`
- **Protocol**: MCP over stdio

## Setup

### 1. Install

```bash
npm install -g @modelcontextprotocol/server-slack
```

### 2. Create Slack App

1. Go to https://api.slack.com/apps
2. Create a new app for your workspace
3. Add required scopes: `channels:read`, `channels:history`, `chat:write`, `users:read`
4. Install to your workspace
5. Copy the Bot User OAuth Token

### 3. Configure `.mcp.json`

```json
{
  "mcpServers": {
    "slack": {
      "command": "npx",
      "args": ["-y", "@modelcontextprotocol/server-slack"],
      "env": {
        "SLACK_BOT_TOKEN": "xoxb-your-bot-token",
        "SLACK_TEAM_ID": "T0000000000"
      }
    }
  }
}
```

### 4. Verify

Ask your AI assistant: "List Slack channels" — you should see your workspace channels.

## Agent Workflows

### Launch Coordination
When @prod-ops runs `/launch-readiness`:
- Posts checklist status to #launches channel
- Notifies team leads of blockers
- Sends go/no-go decision to stakeholders

### Decision Communication
When @pm-dir records a decision with `/decision-record`:
- Posts summary to relevant channel
- Tags stakeholders mentioned in the decision
- Links back to the full decision document

### Campaign Updates
When @pmm coordinates launch messaging:
- Shares draft messaging for review
- Posts final announcements to #marketing
- Coordinates timing with other channels
