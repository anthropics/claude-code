import type { Args } from 'claude-code'

/**
 * The question the engine puts to `tool.check` for a connector's tool the
 * organization's administrators let be asked about: its ceiling is `ask`.
 */
export const CAPPED: Args<'tool.check'> = {
  tool: 'mcp__corp__send',
  input: { to: 'everyone' },
  ceiling: 'ask',
}
