import type { ToolInfo } from 'claude-code'

/**
 * The session's tools: one from the organization's MCP server, one built in.
 */
export const TOOLS: readonly ToolInfo[] = [
  {
    name: 'mcp__corp__search',
    description: 'Searches the corp wiki.',
    mcp: true,
  },
  { name: 'Bash', description: 'Runs a command.', mcp: false },
]
