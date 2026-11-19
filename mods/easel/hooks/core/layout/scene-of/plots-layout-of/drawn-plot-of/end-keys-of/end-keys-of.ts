import Lists from '../../../../../lists'
import type Types from '../../../../types'
import { lineEndsOf } from './line-ends-of'

/**
 * Only a series with a key has one at its line's end.
 *
 * @param rows the series whose lines are drawn
 * @param yOf the way from a position on the value axis to rows of the plot
 * @returns the ends of the lines, by the row of the plot that each stands on
 */
export const endKeysOf = (
  rows: Types.PlotRows,
  yOf: Types.DrawnPlot['yOf'],
): Map<number, Types.LineEnd[]> =>
  Lists.groupBy(
    rows.filter(row => row.key).flatMap(row => lineEndsOf(row, yOf)),
    lineEnd => lineEnd.row,
  )
