---
allowed-tools: none
description: List available MCP tools with filtering options
---

## Context

MCP (Model Context Protocol) tools available in the current session.

## Your task

List all available MCP tools in a structured format. The output should include:

1. Tool ID/Name
2. Description
3. Server/Agent it belongs to
4. Required parameters
5. Optional parameters
6. Permission requirements (if any)

### Output Format Options

Provide output in one of these formats based on user preference:
- **Human-readable** (default): Formatted table or list
- **JSON**: Machine-parseable JSON structure
- **CSV**: Comma-separated values for spreadsheet import

### Filtering Options

Support filtering by:
- `--server <name>`: Show only tools from specific server
- `--agent <type>`: Show only tools for specific agent type
- `--permissions <level>`: Filter by permission requirements
- `--search <term>`: Search in tool names and descriptions

### Example Output (Human-readable)

```
MCP Tools Available (15 total)
================================

GitHub Tools (5):
-----------------
• mcp__github__get_issue
  Description: Get detailed information about a GitHub issue
  Parameters: 
    - owner (required): Repository owner
    - repo (required): Repository name
    - issue_number (required): Issue number
  Permissions: read:repo

• mcp__github__update_issue
  Description: Update a GitHub issue's title, body, or state
  Parameters:
    - owner (required): Repository owner
    - repo (required): Repository name
    - issue_number (required): Issue number
    - title (optional): New title
    - body (optional): New body text
    - state (optional): open/closed
  Permissions: write:repo

IDE Tools (2):
--------------
• mcp__ide__getDiagnostics
  Description: Get language diagnostics from VS Code
  Parameters:
    - uri (optional): File URI for diagnostics
  Permissions: read:workspace

[Additional tools...]
```

### Example Output (JSON)

```json
{
  "total": 15,
  "servers": {
    "github": {
      "tools": [
        {
          "id": "mcp__github__get_issue",
          "description": "Get detailed information about a GitHub issue",
          "parameters": {
            "required": ["owner", "repo", "issue_number"],
            "optional": []
          },
          "permissions": ["read:repo"]
        }
      ]
    }
  }
}
```

This command should enumerate tools without invoking them, respecting existing permission models and working across all platforms.