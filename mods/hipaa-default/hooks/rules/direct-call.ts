import type { Args, EventResult, NextOrigin } from 'claude-code'

import { blockedToolRefusal } from './blocked-tool.js'
import { unreadCeilingRefusal } from './unread-ceiling.js'

/**
 * The refusal of a mod's own file or process call, by the rule its tool twin
 * meets. A built-in's, as `/diff` makes, is decided beneath.
 *
 * @param e the twin's check
 * @param origin who makes the call (`next.origin`)
 * @returns the deny, or undefined for a call decided beneath
 */
export function directCallRefusal(
  { tool, ceiling }: Args<'tool.check'>,
  origin: NextOrigin,
): EventResult<'tool.check'> | undefined {
  const refusal = ceiling === 'deny' ? blockedToolRefusal : unreadCeilingRefusal

  return origin.tier === 'builtin' ? undefined : refusal(tool, origin)
}
