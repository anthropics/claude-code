import type { EventResult } from 'claude-code'

/**
 * The engine's verdict for a call of a tool under an organization's ask
 * ceiling that no rule decided: the ask, naming the ceiling.
 */
export const CAPPED_ASK: EventResult<'tool.check'> = {
  decision: 'ask',
  reason: 'Your organization requires approval for this tool',
  ceiling: 'ask',
}
