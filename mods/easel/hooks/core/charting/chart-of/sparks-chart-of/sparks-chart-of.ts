import Calendar from '../../../calendar'
import Lists from '../../../lists'
import Limits from '../../limits'
import { missingSampleNotes } from '../../missing-sample-notes'
import { plotOf } from '../../plot-of'
import Records from '../../records'
import type Types from '../../types'
import { UNKEYED } from '../../unkeyed'
import { sparksChartIn } from './sparks-chart-in'

/**
 * Draws each series on a row of its own, all on one scale.
 *
 * Series of one sample have no step: the sample takes the whole span.
 *
 * @param options the series to draw, the frame around them, and the call
 * @returns the chart of small rows
 */
export function sparksChartOf({
  topSeries,
  frame: { header, notes },
  request,
  data,
}: Types.SparksOptions): Types.Chart {
  const { ticks, rows } = plotOf({
    seriesOfPlot: topSeries,
    identityOf: () => UNKEYED,
    maxAxisSteps: Records.MAX_AXIS_STEPS.onePlot,
    request,
    data,
  })
  const positionOf = Calendar.positionIn(data.timeline)
  const steps = topSeries
    .flatMap(series => {
      const positions = series.samples.map(sample => positionOf(sample.ms))

      return Lists.zip(positions, positions.slice(1)).map(
        ([earlier, later]) => later - earlier,
      )
    })
    .toSorted((first, second) => first - second)

  return sparksChartIn(
    {
      header: {
        ...header,
        facts: [
          ...header.facts,
          `each from ${ticks[0]?.label} to ${ticks.at(-1)?.label}`,
        ],
      },
      notes: [...notes, ...missingSampleNotes(topSeries)],
    },
    rows,
    steps[Math.floor(steps.length / Limits.PARTS_AROUND_THE_MEDIAN)] ?? 1,
  )
}
