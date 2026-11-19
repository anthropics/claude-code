import Lists from '../../lists'
import Limits from '../limits'
import type Types from '../types'
import { spanOf } from './span-of'

/**
 * Lays the pieces end to end and measures them in eighths of a cell.
 *
 * @param parts what to lay out, in order
 * @param sizeOf the size of one part, in cells
 * @param start the eighths at which the first part begins
 * @returns where each part begins and ends, with its ink
 */
export function spansOf<Part extends Types.Inked>(
  parts: Part[],
  sizeOf: (part: Part) => number,
  start: number,
): Types.Span[] {
  const eighthsOf = (part: Part): number =>
    sizeOf(part) * Limits.EIGHTHS_PER_CELL

  return Lists.laidEndToEnd(parts, eighthsOf, start).map(({ part, end }) =>
    spanOf(end - eighthsOf(part), end, part.ink),
  )
}
