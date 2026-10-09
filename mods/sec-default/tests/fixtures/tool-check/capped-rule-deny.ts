import type { EventResult } from 'claude-code'

import { RULE_DENY } from './rule-deny.js'

/**
 * The engine's verdict when a deny rule matched a call of a tool under an
 * organization's ask ceiling: the rule's deny, naming the ceiling too.
 */
export const CAPPED_RULE_DENY: EventResult<'tool.check'> = {
  ...RULE_DENY,
  ceiling: 'ask',
}
