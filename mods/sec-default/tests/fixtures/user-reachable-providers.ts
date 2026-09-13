import type { Origin } from 'claude-code'

/**
 * Providers whose subjects a plugin the person installed may still
 * rewrite: a person's plugin or MCP server, a bundled plugin, the engine.
 */
export const USER_REACHABLE_PROVIDERS: readonly Origin[] = [
  { plugin: 'mine@market', tier: 'user' },
  { plugin: 'mcp:mine', tier: 'user' },
  { plugin: 'bundled@builtin', tier: 'builtin' },
  { plugin: 'engine', tier: 'core' },
]
