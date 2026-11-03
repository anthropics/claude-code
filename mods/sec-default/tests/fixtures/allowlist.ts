import type { Settings } from 'claude-code'

/**
 * Managed settings holding an MCP allowlist: a tool policy in force.
 */
export const ALLOWLIST: Settings = {
  allowedMcpServers: [{ serverName: 'corp' }],
}
