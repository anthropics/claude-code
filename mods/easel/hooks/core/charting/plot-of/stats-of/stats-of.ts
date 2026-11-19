import Lists from '../../../lists'
import Numbers from '../../../numbers'
import Limits from '../../limits'
import { peakTimeOf } from '../../peak-time-of'
import type Types from '../../types'
import { unitOf } from '../../unit-of'

/**
 * A legend column holds the stats of one kind, so they share a format.
 *
 * @param options the series, the values on their axis, and when they run
 * @returns the stats of each series, the most wanted first
 */
export function statsOf({
  seriesOfPlot,
  axisValues,
  timeline,
  isSummed,
}: Types.StatsOptions): Types.Stat[][] {
  const unit = unitOf(seriesOfPlot)
  const valueLists = seriesOfPlot.map(series => series.values)
  const formatColumn = (column: number[]): string[] =>
    Numbers.formatValues(unit, column, {
      peers: axisValues,
      minWritten: Limits.MIN_STAT_ON_AXIS_PREFIX,
    })
  const maxima = formatColumn(valueLists.map(values => Math.max(...values)))
  const lasts = formatColumn(valueLists.map(values => values.at(-1) ?? 0))
  const minima = formatColumn(valueLists.map(values => Math.min(...values)))
  const means = formatColumn(
    valueLists.map(values => Lists.sumOf(values) / values.length),
  )
  const totals = Numbers.formatValues(unit, valueLists.map(Lists.sumOf))

  return seriesOfPlot.map((series, index): Types.Stat[] => {
    if (series.values.length === 1) {
      return [['last', lasts[index] ?? '', '']]
    }

    const stats: Types.Stat[] = [
      ['max', maxima[index] ?? '', `at ${peakTimeOf(series, timeline)}`],
      ['last', lasts[index] ?? '', ''],
      ['min', minima[index] ?? '', ''],
      ['mean', means[index] ?? '', ''],
    ]

    return isSummed ? [...stats, ['total', totals[index] ?? '', '']] : stats
  })
}
