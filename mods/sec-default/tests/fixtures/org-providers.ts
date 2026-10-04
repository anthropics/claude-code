import type { Origin } from 'claude-code'

/**
 * Providers in the organization's tiers: a policy-installed plugin
 * (prepended by default, or appended), a policy MCP server, its folder.
 */
export const ORG_PROVIDERS: readonly Origin[] = [
  { plugin: 'suite@corp-market', tier: 'prepend' },
  { plugin: 'audit@corp-market', tier: 'append' },
  { plugin: 'mcp:corp', tier: 'prepend' },
  { plugin: 'policy', tier: 'prepend' },
]
