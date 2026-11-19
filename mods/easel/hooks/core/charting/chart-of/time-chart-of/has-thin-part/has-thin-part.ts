import Limits from '../../../limits'
import type Types from '../../../types'

/**
 * Tells whether a part of some stack is too thin for a terminal row.
 *
 * @param plot the plot whose stacked columns are measured
 * @returns whether any part is thinner than the limit
 */
export function hasThinPart(plot: Types.Plot): boolean {
  const stackTopAt = new Map<number, number>()

  for (const point of plot.rows.flatMap(row => row.stretches.flat())) {
    const height = point.y - (stackTopAt.get(point.x) ?? 0)
    const isThinPart =
      plot.rows.length > 1 && height > 0 && height < Limits.THIN_PART_POSITION

    if (isThinPart) {
      return true
    }

    stackTopAt.set(point.x, point.y)
  }

  return false
}
