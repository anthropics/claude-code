import Limits from '../../../../limits'
import type Types from '../../../../types'

/**
 * Makes the area where lines are drawn: it takes all the free cells, and
 * the last sample stands in the middle of the last cell.
 *
 * @param left the first cell to the right of the value axis
 * @param freeWidth the cells from there to the end of the free cells
 * @returns where the area stands, and the way from a position to its x
 */
export function lineAreaOf(left: number, freeWidth: number): Types.PlotArea {
  const xOf = (position: number): number =>
    left + position * (freeWidth - Limits.HALF_CELL)

  return { left, width: freeWidth, columnWidth: 0, xOf, tickXOf: xOf }
}
