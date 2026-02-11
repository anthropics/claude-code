# GitHub Integration

## What It Enables

| Agent | Capabilities |
|-------|-------------|
| @pm | Create issues from feature specs, track PRs |
| @prod-ops | Monitor release readiness, deployment status |
| @pm-dir | Track delivery across repositories |

## MCP Server

- **Package**: `@modelcontextprotocol/server-github`
- **Protocol**: MCP over stdio

## Setup

### 1. Install

```bash
npm install -g @modelcontextprotocol/server-github
```

### 2. Create Personal Access Token

1. Go to GitHub Settings > Developer Settings > Personal Access Tokens
2. Create a token with scopes: `repo`, `issues:write`, `pull_requests:read`
3. Copy the token

### 3. Configure `.mcp.json`

```json
{
  "mcpServers": {
    "github": {
      "command": "npx",
      "args": ["-y", "@modelcontextprotocol/server-github"],
      "env": {
        "GITHUB_PERSONAL_ACCESS_TOKEN": "ghp_your-token"
      }
    }
  }
}
```

### 4. Verify

Ask your AI assistant: "List my GitHub repositories" — you should see your repos.

## Agent Workflows

### Feature Spec to Issues
When @pm creates a `/feature-spec`:
- Creates a GitHub issue with full spec as body
- Adds labels based on feature area
- Links to parent epic/milestone if specified

### Release Tracking
When @prod-ops checks `/launch-readiness`:
- Reviews open PRs and their review status
- Checks CI/CD pipeline status
- Verifies all release blockers are resolved
