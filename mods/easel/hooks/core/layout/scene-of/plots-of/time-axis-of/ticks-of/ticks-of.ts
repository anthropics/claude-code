import Calendar from '../../../../../calendar'
import type Types from '../../../../types'
import { middleOfPeriodIn } from './middle-of-period-in'
import { tickColumnOn } from './tick-column-on'

/**
 * Picks the ticks of the time axis that fit under the plots.
 *
 * Where the plots are columns, a tick sits at the middle of its period;
 * otherwise it sits where its time falls.
 *
 * @param toLay the time on the axis and the plots above it
 * @returns the ticks, each with its column and its label
 */
export function ticksOf(toLay: Types.TimeAxisToLay): Calendar.TimeTick[] {
  const hasColumns = toLay.area.columnWidth > 0
  const columnOf = tickColumnOn(
    toLay.area,
    hasColumns
      ? middleOfPeriodIn(toLay.timeline)
      : Calendar.positionIn(toLay.timeline),
  )

  return Calendar.timeTicks(toLay.timeline.dataSpan, toLay.timeline.step, {
    columns: toLay.area.width,
    columnOf,
    areCentred: hasColumns,
  })
}
