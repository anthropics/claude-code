import type { EventResult } from 'claude-code'

import { askKind } from './ask-kind.js'

/**
 * What kind of thing held over a person's plugin, as the notice calls it:
 * `deny rule`, `ask rule`, `refusal`, or whose ask it was.
 *
 * A deny that names no rule is a refusal even when it names a hook: the hook
 * may only have asked, and something else refused.
 *
 * @param held the verdict that holds
 * @returns the kind
 */
export function heldKind(held: EventResult<'tool.check'>): string {
  const isRuled = held.rule !== undefined
  const isRefused = held.decision === 'deny'

  return isRuled
    ? `${held.decision} rule`
    : isRefused
      ? 'refusal'
      : askKind(held)
}
