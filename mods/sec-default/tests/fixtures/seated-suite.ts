import type { Settings } from 'claude-code'

/**
 * Managed settings that seat the corp-suite plugin, whose own manifest
 * declares the corp-jira MCP server.
 */
export const SEATED_SUITE: Settings = {
  prependPlugins: ['corp-suite@market'],
}
