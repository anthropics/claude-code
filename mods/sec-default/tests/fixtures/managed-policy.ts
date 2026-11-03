import type { Settings } from 'claude-code'

/**
 * Managed settings with an MCP allowlist naming the corp server and one
 * policy-installed plugin, `suite`.
 */
export const MANAGED_POLICY: Settings = {
  allowedMcpServers: [{ serverName: 'corp' }],
  enabledPlugins: { 'suite@corp-market': true },
}
