import Lists from '../../../lists'
import type Types from '../../types'
import { barRowsOf } from '../bar-rows-of'
import { totalRowOf } from '../total-row-of'

/**
 * Draws one bar for each series, and one more for their sum when summed.
 *
 * A ranking, asked for or forced by a cut, shows the largest series only.
 *
 * @param options the frame, the series as selected and as read, and the call
 * @returns the chart of bars
 */
export function barsChartOf(options: Types.BarsChartOptions): Types.BarsChart {
  const isSummed = options.request.combine === 'sum'
  const isRanked =
    options.request.top !== undefined || options.selection.cutSeries.length > 0
  const shownBars = isRanked ? options.selection.topSeries : options.allSeries
  const allValues = options.allSeries.flatMap(series => series.values)
  const barRows = barRowsOf(shownBars, allValues, {
    isSummed,
    measures: Lists.distinct(options.allSeries.map(series => series.measure)),
  })
  const rows = isSummed
    ? [...barRows, totalRowOf(shownBars, allValues)]
    : barRows

  return {
    form: 'bars',
    header: options.frame.header,
    rows,
    notes: options.frame.notes,
  }
}
