import type { Settings } from 'claude-code'

/**
 * Whether the policy read marks the organization's server file
 * (managed-mcp.json) as present and unreadable: its servers cannot be named.
 *
 * @param policy the managed settings, as `$.settings.read` answers them
 * @returns true when the mark is set
 */
export const isServerFileUnreadable = (policy: Settings): boolean =>
  policy.managedMcpServersUnreadable === true
