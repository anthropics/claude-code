import type { ToolInfo } from 'claude-code'

/**
 * The session's tools: one of the seated corp-suite plugin's own MCP server,
 * as the engine spells it, and one built in.
 */
export const SUITE_TOOLS: readonly ToolInfo[] = [
  {
    name: 'mcp__plugin_corp-suite_corp-jira__create_ticket',
    description: 'Creates a ticket.',
    mcp: true,
  },
  { name: 'Bash', description: 'Runs a command.', mcp: false },
]
