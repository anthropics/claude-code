import Limits from '../../../../limits'
import { snapped } from '../../../../snapped'
import type Types from '../../../../types'

/**
 * Makes the area where columns are drawn, one pitch of cells a period.
 *
 * The last cell of a period stays blank, unless it is the only one. A tick
 * stands at the middle of its period's column, the last period's at most.
 *
 * @param left the first cell to the right of the value axis
 * @param columnPitch the whole cells that each period takes, 1 or more
 * @param periodCount the periods to draw as columns
 * @returns where the area stands, and the way from a position to its x
 */
export function columnAreaOf(
  left: number,
  columnPitch: number,
  periodCount: number,
): Types.PlotArea {
  const columnWidth = Math.max(1, columnPitch - 1)
  const xOf = (position: number): number =>
    left + Math.floor(snapped(position * periodCount)) * columnPitch
  const tickXOf = (position: number): number =>
    Math.min(xOf(position), xOf((periodCount - 1) / periodCount)) +
    columnWidth / Limits.HALVES

  return {
    left,
    width: columnPitch * periodCount,
    columnWidth,
    xOf,
    tickXOf,
  }
}
