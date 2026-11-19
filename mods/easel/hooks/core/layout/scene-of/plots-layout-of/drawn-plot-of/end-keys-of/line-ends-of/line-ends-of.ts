import type Types from '../../../../../types'
import { lineEnd } from './line-end'

/**
 * A line ends at its last sample. With no sample there is no end.
 *
 * @param series the series that the line draws
 * @param yOf the way from a position on the value axis to rows of the plot
 * @returns the end of the line, or nothing
 */
export function lineEndsOf(
  series: Types.PlotRows[number],
  yOf: Types.DrawnPlot['yOf'],
): Types.LineEnd[] {
  const lastSample = series.stretches.at(-1)?.at(-1)

  return lastSample ? [lineEnd(series, Math.floor(yOf(lastSample.y)))] : []
}
