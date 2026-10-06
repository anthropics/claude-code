---
allowed-tools: none
description: Show detailed information about a specific MCP tool
---

## Context

Inspect a specific MCP tool to understand its capabilities, parameters, and usage.

## Your task

Display comprehensive information about the specified MCP tool.

### Required Input

- `tool_id`: The identifier of the tool to inspect (e.g., `mcp__github__get_issue`)

### Information to Display

1. **Basic Information**
   - Tool ID/Name
   - Full description
   - Server/Agent source
   - Version (if available)

2. **Parameters**
   - Required parameters with descriptions and types
   - Optional parameters with descriptions, types, and defaults
   - Parameter validation rules (if any)

3. **Permissions**
   - Required permissions
   - Scope of access
   - Security considerations

4. **Usage Examples**
   - Sample invocations
   - Common use cases
   - Integration patterns

5. **Related Tools**
   - Similar or complementary tools
   - Tools often used together

### Example Output

```
Tool: mcp__github__get_issue
==============================

Description:
  Retrieves detailed information about a specific GitHub issue,
  including title, body, labels, assignees, and comments.

Server: GitHub MCP Server
Agent: github-integration
Version: 1.0.0

Parameters:
-----------
Required:
  • owner (string): The GitHub username or organization that owns the repository
    Example: "anthropics"
  
  • repo (string): The name of the repository
    Example: "claude-code"
  
  • issue_number (integer): The issue number to retrieve
    Range: 1 to unlimited
    Example: 6574

Optional:
  • include_comments (boolean): Whether to include issue comments
    Default: false
  
  • comment_limit (integer): Maximum number of comments to retrieve
    Default: 10
    Range: 1 to 100

Permissions:
------------
  • read:repo - Read access to repository issues
  • read:org - Read access to organization (if private repo)

Usage Examples:
---------------
1. Get basic issue information:
   {
     "tool": "mcp__github__get_issue",
     "parameters": {
       "owner": "anthropics",
       "repo": "claude-code",
       "issue_number": 6574
     }
   }

2. Get issue with comments:
   {
     "tool": "mcp__github__get_issue",
     "parameters": {
       "owner": "anthropics",
       "repo": "claude-code",
       "issue_number": 6574,
       "include_comments": true,
       "comment_limit": 50
     }
   }

Common Use Cases:
-----------------
  • Checking issue status and details
  • Gathering context before updating an issue
  • Retrieving issue comments for analysis
  • Validating issue existence before operations

Related Tools:
--------------
  • mcp__github__update_issue - Update the retrieved issue
  • mcp__github__get_issue_comments - Get only comments
  • mcp__github__search_issues - Find similar issues
  • mcp__github__list_issues - List all repository issues

Notes:
------
  • Rate limited to 5000 requests per hour
  • Requires authentication for private repositories
  • Returns null if issue doesn't exist or is inaccessible
```

### Output Format Options

- **--json**: Output in JSON format for programmatic use
- **--markdown**: Output in Markdown format for documentation
- **--brief**: Show only essential information

This command provides deep visibility into tool capabilities without executing the tool itself.