# Notion Integration

## What It Enables

| Agent | Capabilities |
|-------|-------------|
| @pm | Publish PRDs and specs to team wiki |
| @pmm | Share positioning docs, competitive intel |
| @vp-product | Publish strategy documents, roadmap views |
| @prod-ops | Maintain process documentation |

## MCP Server

- **Package**: `@anthropic/mcp-notion` or community Notion MCP server
- **Protocol**: MCP over stdio

## Setup

### 1. Install

```bash
npm install -g @anthropic/mcp-notion
```

### 2. Create Notion Integration

1. Go to https://www.notion.so/my-integrations
2. Create a new integration
3. Give it read/write access to relevant pages
4. Copy the Internal Integration Secret

### 3. Configure `.mcp.json`

```json
{
  "mcpServers": {
    "notion": {
      "command": "npx",
      "args": ["@anthropic/mcp-notion"],
      "env": {
        "NOTION_API_KEY": "ntn_your-integration-secret"
      }
    }
  }
}
```

### 4. Share Pages

Share the Notion pages/databases you want agents to access with your integration.

### 5. Verify

Ask your AI assistant: "Search Notion for recent pages" — you should see shared pages.

## Agent Workflows

### PRD Publishing
When @pm creates a PRD with `/prd`:
- Creates a new page in the designated Notion database
- Formats sections as Notion blocks
- Adds metadata (status, owner, date)

### Strategy Documentation
When @vp-product creates strategy documents:
- Publishes to the strategy section of the wiki
- Cross-links related decisions and bets
- Maintains version history
