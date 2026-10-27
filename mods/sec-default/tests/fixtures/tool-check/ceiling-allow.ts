import type { EventResult } from 'claude-code'

/**
 * What a plugin's allow reads as for a call an organization caps at ask:
 * the allow, under the ceiling the engine stamps on it.
 */
export const CEILING_ALLOW: EventResult<'tool.check'> = {
  decision: 'allow',
  ceiling: 'ask',
}
