import type { EventResult } from 'claude-code'

/**
 * An auto-approve plugin's allow as the chain hands it up for a call of a
 * tool under an organization's ask ceiling: the engine names the ceiling.
 */
export const CAPPED_ALLOWED: EventResult<'tool.check'> = {
  decision: 'allow',
  ceiling: 'ask',
}
