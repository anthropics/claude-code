import type { EventResult } from 'claude-code'

/**
 * The engine's verdict for a connector tool an organization caps at ask: the
 * ask, and the ceiling the engine stamps on every verdict for the call.
 */
export const CEILING_ASK: EventResult<'tool.check'> = {
  decision: 'ask',
  reason: 'Your organization requires approval for this tool.',
  ceiling: 'ask',
}
