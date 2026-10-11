import type { EventResult } from 'claude-code'

/**
 * What kind of thing held over a person's plugin, as the notice calls it:
 * `deny rule`, `ask rule`, `<event> hook's ask`, `ask cap`, or `refusal`.
 *
 * A deny that names no rule is a refusal even when it names a hook: the hook
 * may only have asked, and something else refused. An ask that names neither
 * holds by the ceiling an organization set on the tool.
 *
 * @param held the verdict that holds
 * @returns the kind
 */
export function heldKind(held: EventResult<'tool.check'>): string {
  const isRuled = held.rule !== undefined
  const isRefused = held.decision === 'deny'
  const isHooked = held.hook !== undefined

  return isRuled
    ? `${held.decision} rule`
    : isRefused
      ? 'refusal'
      : isHooked
        ? `${held.hook} hook's ask`
        : 'ask cap'
}
