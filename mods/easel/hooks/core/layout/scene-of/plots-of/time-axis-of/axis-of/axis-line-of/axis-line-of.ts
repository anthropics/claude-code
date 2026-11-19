import type Calendar from '../../../../../../calendar'
import Lists from '../../../../../../lists'
import type Types from '../../../../../types'

/**
 * Draws the line of the time axis, with a mark at the column of each tick.
 *
 * @param ticks what the line marks
 * @param area the plots above the axis
 * @returns the line, one character a column
 */
export const axisLineOf = (
  ticks: Calendar.TimeTick[],
  area: Types.PlotArea,
): string =>
  Lists.indexesBelow(area.width)
    .map(column => {
      const isAtATick = ticks.some(tick => tick.column === column)

      return isAtATick ? '┬' : '─'
    })
    .join('')
