import type { EventResult } from 'claude-code'

/**
 * The engine's verdict in a hosted session when nothing allows or denies
 * the call: the mode's own ask, which the host answers.
 */
export const HOST_ASK: EventResult<'tool.check'> = {
  decision: 'ask',
  reason: 'The host answers this one',
}
