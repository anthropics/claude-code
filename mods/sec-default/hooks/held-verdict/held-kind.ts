import type { EventResult } from 'claude-code'

/**
 * What kind of thing held over a person's plugin, as the notice calls it:
 * `deny rule`, `ask rule`, or `refusal`, a deny that names no rule.
 *
 * @param held the verdict that holds
 * @returns the kind
 */
export const heldKind = (held: EventResult<'tool.check'>) =>
  held.rule === undefined ? 'refusal' : `${held.decision} rule`
