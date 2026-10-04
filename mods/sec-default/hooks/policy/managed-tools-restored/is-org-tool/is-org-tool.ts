import type { Settings } from 'claude-code'

import { orgServerNames } from './org-server-names'

/**
 * Whether a tool is one of a managed MCP server's: `mcp__<server>__...` for
 * a server the policy's allowlist names.
 *
 * @param policy the managed settings, as `$.settings.read` answers them
 * @param tool the tool's name as the model calls it
 * @returns true for a managed server's tool
 */
export const isOrgTool = (policy: Settings, tool: string) =>
  orgServerNames(policy).some(server => tool.startsWith(`mcp__${server}__`))
