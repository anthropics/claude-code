import type Shapes from '../../../shapes'
import type Types from '../../types'

/**
 * One part as laid out: where it begins, where it ends and its ink.
 *
 * @param start the eighths at which the part begins
 * @param end the eighths at which the part ends
 * @param ink the ink of the part
 * @returns the span
 */
export const spanOf = (
  start: number,
  end: number,
  ink: Shapes.Ink,
): Types.Span => ({ from: start, to: end, ink })
