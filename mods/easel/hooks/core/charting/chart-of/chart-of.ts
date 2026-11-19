import type CoreCall from '../../call'
import Forms from '../../forms'
import type Reading from '../../reading'
import { sizedSeriesOf } from '../sized-series-of'
import type Types from '../types'
import { unitOf } from '../unit-of'
import { barsChartOf } from './bars-chart-of'
import { cutNotes } from './cut-notes'
import { groupedByScale } from './grouped-by-scale'
import { headerOf } from './header-of'
import { likelyTotalNotes } from './likely-total-notes'
import { peakOfTotalFact } from './peak-of-total-fact'
import { selectionOf } from './selection-of'
import { shareChartOf } from './share-chart-of'
import { sparksChartOf } from './sparks-chart-of'
import { timeChartOf } from './time-chart-of'

/**
 * Turns what was read into a chart: which series are drawn, every word about
 * them, and every position. It runs once, before any width is known.
 *
 * A form that shows a whole draws the series past the largest as one more.
 * Bars keep the order of the input, unless a ranking is asked for.
 *
 * @param data the series that were read, with their timeline and marks
 * @param request what the call asked for
 * @returns the chart, in words and positions
 */
export function chartOf(
  data: Reading.Data,
  request: CoreCall.ChartRequest,
): Types.Chart {
  const isSummed = request.combine === 'sum'
  const hasPlotPerSeries = data.form === 'columns' && !isSummed
  const allSeries = data.series.map(sizedSeriesOf)
  const isWhole =
    data.form === 'share' ||
    (data.form === 'columns' &&
      isSummed &&
      allSeries.every(series => series.unit === unitOf(allSeries)))
  const formLimit = hasPlotPerSeries
    ? Forms.MAX_PLOTS
    : Forms.FORMS[data.form].maxCount
  const selection = selectionOf(
    allSeries,
    Math.min(request.top ?? Forms.FORMS[data.form].defaultCount, formLimit),
    isWhole,
  )
  const isCombinedOtherwise = data.hasCombinedRows && !isSummed
  const hasPeakOfTotal =
    data.form === 'columns' && isWhole && allSeries.length > 1
  const header = headerOf(data, request, [
    ...(data.subject === '' ? [] : [data.subject]),
    ...data.timeline.spanLabels,
    ...(request.log ? ['log scale'] : []),
    ...(isCombinedOtherwise ? [`rows combined by ${request.combine}`] : []),
    ...(hasPeakOfTotal ? [peakOfTotalFact(allSeries, data.timeline)] : []),
  ])
  const notes = [
    ...data.leftOutNotes,
    ...data.notes,
    ...cutNotes({
      form: data.form,
      cutSeries: selection.cutSeries,
      drawnAloneCount: selection.topSeries.length,
      isRestDrawnAsOne: isWhole,
      formLimit,
      top: request.top,
    }),
    ...(isSummed
      ? likelyTotalNotes(allSeries, Forms.FORMS[data.form].plural)
      : []),
  ]

  switch (data.form) {
    case 'bars':
      return barsChartOf({
        frame: { header, notes },
        selection,
        allSeries,
        request,
      })
    case 'share':
      return shareChartOf({ header, notes }, selection, allSeries)
    case 'sparks':
      return sparksChartOf({
        topSeries: selection.topSeries,
        frame: { header, notes },
        request,
        data,
      })
    case 'line':
    case 'columns':
      return timeChartOf({
        groups: hasPlotPerSeries
          ? selection.topSeries.map(series => [series])
          : groupedByScale(
              selection.drawnSeries,
              data.form === 'columns' || request.log === true,
            ),
        frame: { header, notes },
        request,
        data,
      })
  }
}
