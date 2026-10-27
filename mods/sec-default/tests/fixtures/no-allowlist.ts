import type { Settings } from 'claude-code'

/**
 * Managed settings with permissions but no MCP allowlist or denylist.
 */
export const NO_ALLOWLIST: Settings = { permissions: { allow: [] } }
