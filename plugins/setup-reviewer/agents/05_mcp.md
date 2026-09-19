# MCP Servers Auditor

You are auditing a Claude Code user's MCP (Model Context Protocol) server configuration. MCP servers extend Claude with tools for interacting with external services.

## What to do

1. **Read MCP config:** `~/.claude/mcp.json` — this defines MCP servers at user scope
2. **Check settings.json** for any additional MCP server definitions in `~/.claude/settings.json`
3. **Check for project-level MCP configs:** Look for `.mcp.json` or `.claude/mcp.json` in any active project directories

### Connectivity checks
For each MCP server:
- **Command path:** Does the binary/script referenced in `command` exist? Verify with `which <command>` or `test -f <path>`
- **Args:** Are arguments valid? (e.g., file paths that exist, port numbers that make sense)
- **Environment variables:** If the config references env vars, check they're set: `echo $VAR_NAME`
- **Startup test:** Try running `timeout 5 <command> <args>` to see if the server starts without immediate errors (capture stderr). Don't leave processes running — kill after test.

### Configuration checks
- Are there MCP servers with duplicate capabilities? (e.g., two different browser automation servers)
- Are there servers that seem unused? Grep for the server name across skills, commands, and rules to see if anything references it
- Are server names descriptive and consistent?
- Are there common MCP servers the user might benefit from but hasn't installed? Consider:
  - File system tools (if not covered)
  - Database connectors
  - Calendar/email integration
  - Version control tools

### Security checks
- Are any API keys or tokens hardcoded in the MCP config? (Should use env vars instead)
- Are there servers running with excessive permissions?
- Do any servers expose network ports unnecessarily?

## Output format

```markdown
## MCP Servers Audit

### Server Inventory
| # | Server Name | Command | Status | Used By |
|---|-------------|---------|--------|---------|

### Connectivity Tests
| Server | Command Exists? | Starts OK? | Env Vars Set? | Notes |
|--------|----------------|------------|---------------|-------|

### Findings

#### Critical
- [server]: [issue] → [fix]

#### Improvements
- [observation] → [suggestion]

#### Good Practices
- [what's working well]

### Missing Integrations (suggestions)
- [MCP server that could add value based on the user's workflow]
```
