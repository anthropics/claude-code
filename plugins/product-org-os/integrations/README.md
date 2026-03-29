# Integration Templates

Connect your Product Org to real tools. Each template describes how to set up an MCP server so agents can interact with your actual project management, communication, and analytics tools.

## How It Works

1. **Install an MCP server** for your tool (see templates below)
2. **Configure in `.mcp.json`** with your credentials
3. **Agents auto-detect** — no plugin changes needed

When a connected tool is available, agents use it automatically. When it's not, they produce text output with manual action notes. Zero configuration in the plugin itself.

## Available Integration Templates

| Tool | Template | Key Agents |
|------|----------|------------|
| [Jira](jira.md) | Project management | @pm, @pm-dir, @prod-ops |
| [Linear](linear.md) | Project management | @pm, @pm-dir, @prod-ops |
| [Slack](slack.md) | Communication | @prod-ops, @pmm, @pm-dir |
| [Notion](notion.md) | Documentation | @pm, @pmm, @vp-product |
| [GitHub](github.md) | Repository | @pm, @prod-ops |
| [Analytics](analytics.md) | Metrics platforms | @bizops, @value-realization, @ci |

## Adding New Integrations

Any MCP server that follows the Model Context Protocol works. To add a new integration:

1. Install the MCP server package
2. Add configuration to your `.mcp.json`
3. Agents will discover it at runtime via their tool list

No changes to the plugin are needed. The MCP Integration Framework (`rules/mcp-integration.md`) handles discovery and graceful fallback automatically.

## Troubleshooting

| Issue | Solution |
|-------|----------|
| Agent doesn't use connected tool | Verify MCP server is running and tools appear in your tool list |
| Tool errors during agent work | Agent will fall back to text output automatically |
| Need a tool not listed here | Any MCP server works — see the MCP standard at modelcontextprotocol.io |
