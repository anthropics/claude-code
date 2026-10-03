import type { EventResult } from 'claude-code'

/**
 * What kind of thing held over a person's plugin, as the notice calls it:
 * `deny rule`, `ask rule`, `<event> hook's ask`, or `refusal`.
 *
 * A deny that names no rule is a refusal even when it names a hook: the hook
 * may only have asked, and something else refused.
 *
 * @param held the verdict that holds
 * @returns the kind
 */
export function heldKind(held: EventResult<'tool.check'>) {
  if (held.rule !== undefined) {
    return `${held.decision} rule`
  }

  return held.decision === 'deny' ? 'refusal' : `${held.hook} hook's ask`
}
