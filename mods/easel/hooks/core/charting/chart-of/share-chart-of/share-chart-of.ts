import Lists from '../../../lists'
import { barValueOf } from '../../bar-value-of'
import { OTHERS_IDENTITY } from '../../others-identity'
import { SERIES_IDENTITIES } from '../../series-identities'
import type Types from '../../types'
import { barRowsOf } from '../bar-rows-of'

/**
 * Draws each series as its part of the whole that all of them make.
 *
 * The largest series each get an identity; the rest share the one of others.
 *
 * @param frame the words around the parts
 * @param selection the largest series, and the series that are drawn
 * @param allSeries every series that was read, which together are the whole
 * @returns the chart of parts
 */
export function shareChartOf(
  frame: Types.Frame,
  selection: Record<'topSeries' | 'drawnSeries', Types.SizedSeries[]>,
  allSeries: Types.SizedSeries[],
): Types.ShareChart {
  const allValues = allSeries.flatMap(series => series.values)
  const identityByPart = new Map(
    Lists.zip(selection.topSeries, SERIES_IDENTITIES),
  )
  const rows = Lists.zip(
    barRowsOf(selection.drawnSeries, allValues, {
      isSummed: true,
      measures: [],
    }),
    selection.drawnSeries,
  ).map(([bar, part]) => ({
    ...bar,
    ...(identityByPart.get(part) ?? OTHERS_IDENTITY),
    share: barValueOf(part) / Lists.sumOf(allValues),
  }))

  return { form: 'share', header: frame.header, rows, notes: frame.notes }
}
