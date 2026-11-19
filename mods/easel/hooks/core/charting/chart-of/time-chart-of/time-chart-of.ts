import Forms from '../../../forms'
import Lists from '../../../lists'
import Limits from '../../limits'
import { missingSampleNotes } from '../../missing-sample-notes'
import { namesOf } from '../../names-of'
import { OTHERS_IDENTITY } from '../../others-identity'
import { plotOf } from '../../plot-of'
import Records from '../../records'
import { SERIES_IDENTITIES } from '../../series-identities'
import type Types from '../../types'
import { UNKEYED } from '../../unkeyed'
import { hasThinPart } from './has-thin-part'
import { inOrderOfTheCall } from './in-order-of-the-call'
import { markIn } from './mark-in'

/**
 * Gives each group of series a plot, up to the most a chart has.
 *
 * @param options the series by shared scale, the frame, and the call
 * @returns the chart of lines or columns
 */
export function timeChartOf(options: Types.TimeChartOptions): Types.TimeChart {
  const isColumns = options.data.form === 'columns'
  const placedGroups = inOrderOfTheCall(
    options.groups.slice(0, Forms.MAX_PLOTS),
    options.data,
    options.request,
  )
  const placedSeries = placedGroups.flat()
  const unplacedSeries = options.groups.slice(Forms.MAX_PLOTS).flat()
  const identityBySeries = new Map(
    Lists.zip(
      placedSeries.filter(series => !series.isOthers),
      placedSeries.length > 1 ? SERIES_IDENTITIES : [UNKEYED],
    ),
  )
  const identityOf = (series: Types.SizedSeries): Types.SeriesIdentity =>
    identityBySeries.get(series) ?? OTHERS_IDENTITY
  const maxAxisSteps =
    Records.MAX_AXIS_STEPS[placedGroups.length > 1 ? 'severalPlots' : 'onePlot']
  const plots = placedGroups.map(group =>
    plotOf({
      seriesOfPlot: group,
      identityOf,
      maxAxisSteps,
      request: options.request,
      data: options.data,
    }),
  )
  const columnCount = options.data.timeline.periodStarts.length
  const isStacked = placedSeries.length > placedGroups.length
  const mergedColumnsNote =
    `${columnCount} columns do not fit, so they are ` +
    `drawn as ` +
    `${isStacked ? 'lines, one for each series' : 'a line'}`
  const hasUnplacedSeries = unplacedSeries.length > 0
  const hasManyColumns = columnCount > Limits.COLUMNS_THAT_MAY_MERGE
  const hasThinParts = isColumns && plots.some(hasThinPart)
  const notes = [
    ...options.frame.notes,
    ...(hasUnplacedSeries
      ? [
          `${Forms.countedIn(options.data.form, unplacedSeries.length)} ` +
            `not shown (${namesOf(unplacedSeries)}): a chart has at most ` +
            `${Forms.MAX_PLOTS} plots`,
        ]
      : []),
    ...missingSampleNotes(placedSeries),
  ]
  const modelOnlyNotes = [
    ...(hasManyColumns
      ? [
          `on a screen under about ` +
            `${columnCount + Limits.CELLS_BESIDE_THE_COLUMNS} characters ` +
            `wide, ${mergedColumnsNote}`,
        ]
      : []),
    ...(hasThinParts
      ? ['in a terminal, parts of a column thinner than a row may not show']
      : []),
  ]

  return {
    form: isColumns ? 'columns' : 'line',
    header: options.frame.header,
    plots,
    timeline: options.data.timeline,
    marks: options.data.marks.map(markIn(options.data.timeline)),
    notes,
    mergedColumnsNote,
    thinPartsNote: 'the thinnest parts of a column are too thin to show here',
    modelOnlyNotes,
  }
}
