import type { EventResult } from 'claude-code'

/**
 * Whether two `tool.check` verdicts say the same in every field: decision,
 * reason, and the rule, hook or ceiling either names.
 *
 * @param one a verdict
 * @param other another, or undefined when nothing settled
 * @returns true when no field differs
 */
export const isSameVerdict = (
  one: EventResult<'tool.check'>,
  other: EventResult<'tool.check'> | undefined,
) =>
  other !== undefined &&
  [one, other]
    .map(verdict =>
      JSON.stringify(
        Object.entries(verdict)
          .filter(([, value]) => value !== undefined)
          .toSorted(([left], [right]) => (left < right ? -1 : 1)),
      ),
    )
    .every((line, _, lines) => line === lines[0])
