import type { EventResult } from 'claude-code'

/**
 * The engine's verdict when nothing allows or denies the call: ask.
 */
export const ASKED: EventResult<'tool.check'> = {
  decision: 'ask',
  reason: 'Bash needs approval',
}
