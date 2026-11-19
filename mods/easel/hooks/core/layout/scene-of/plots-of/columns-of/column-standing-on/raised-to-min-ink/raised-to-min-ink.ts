import Limits from '../../../../../limits'
import type Types from '../../../../../types'

/**
 * A stack too low to see, raised to `MIN_INK` in its first part's ink.
 *
 * @param parts what the column is made of, the lowest first
 * @returns the parts, the first as high as the least that shows, the rest flat
 */
export const raisedToMinInk = (parts: Types.StackPart[]): Types.StackPart[] =>
  parts.map((part, index) => ({
    ink: part.ink,
    height: index > 0 ? 0 : Limits.MIN_INK,
  }))
