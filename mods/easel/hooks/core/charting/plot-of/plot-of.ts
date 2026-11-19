import Calendar from '../../calendar'
import Lists from '../../lists'
import Numbers from '../../numbers'
import Limits from '../limits'
import type Types from '../types'
import { unitOf } from '../unit-of'
import { plotRowIn } from './plot-row-in'
import { pointIn } from './point-in'
import { statsOf } from './stats-of'
import { statsOptionsOf } from './stats-options-of'

/**
 * Lines may cross. A column stands on those of the series before it.
 *
 * @param options the series that share the value axis, and the call
 * @returns the ticks of the value axis and a row for each series
 */
export function plotOf(options: Types.PlotOptions): Types.Plot {
  const isStacked = options.data.form === 'columns'
  const stackTopAt = new Map<number, number>()
  const stretchesBySeries: Types.Top[][][] = []

  for (const series of options.seriesOfPlot) {
    const stretches: Types.Top[][] = []
    let stretch: Types.Top[] = []

    for (const sample of series.samples) {
      if (sample.value === null) {
        stretches.push(stretch)
        stretch = []
      } else {
        const top =
          (isStacked ? (stackTopAt.get(sample.ms) ?? 0) : 0) + sample.value
        stackTopAt.set(sample.ms, top)
        stretch.push({ ms: sample.ms, top })
      }
    }

    stretches.push(stretch)
    stretchesBySeries.push(stretches.filter(tops => tops.length > 0))
  }

  const drawnValues = stretchesBySeries
    .flat(Limits.LISTS_AROUND_A_TOP)
    .map(point => point.top)
  const unit = unitOf(options.seriesOfPlot)
  const valueRange: [number, number] = [
    isStacked ? 0 : Math.min(...drawnValues),
    Math.max(...drawnValues),
  ]
  const isLogScale = options.request.log === true
  const axis = isLogScale
    ? Numbers.logAxisOf(unit, valueRange, options.maxAxisSteps)
    : Numbers.linearAxisOf(
        Numbers.numberFormatFor(unit, drawnValues),
        valueRange,
        options.maxAxisSteps,
      )

  return {
    ticks: axis.ticks,
    rows: Lists.zip(
      options.seriesOfPlot,
      Lists.zip(
        stretchesBySeries,
        statsOf(statsOptionsOf(options, drawnValues)),
      ),
    ).map(
      plotRowIn(
        options,
        pointIn(Calendar.positionIn(options.data.timeline), axis),
      ),
    ),
  }
}
