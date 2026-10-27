import type { Settings } from 'claude-code'

/**
 * Whether managed policy holds an MCP allowlist (allowedMcpServers set at
 * all, empty included): the organization decides which servers add tools.
 *
 * @param policy the managed settings, as `$.settings.read` answers them
 * @returns true when allowedMcpServers is in force
 */
export const hasMcpAllowlist = (policy: Settings) =>
  Array.isArray(policy.allowedMcpServers)
