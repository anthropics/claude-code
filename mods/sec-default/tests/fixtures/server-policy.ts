import type { Settings } from 'claude-code'

/**
 * Managed settings that deliver the corp MCP server themselves, with no
 * allowlist naming it: a tool policy in force all the same.
 */
export const SERVER_POLICY: Settings = {
  managedMcpServers: { corp: { type: 'http', url: 'https://corp.example/x' } },
}
