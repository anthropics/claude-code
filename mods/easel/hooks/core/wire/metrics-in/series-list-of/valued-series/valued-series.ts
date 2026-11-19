import Json from '../../../../json'
import { entriesAt } from '../../../entries-at'
import type Types from '../../../types'
import Words from '../../../words'

/**
 * One series as the paths of a service reach it: its labels, its times,
 * and the cells it has under the one key `value`.
 *
 * @param node one series of an answer
 * @param format the paths that lead to its labels and to its times
 * @param values its cells, each with its unit
 * @returns the series, with a point per cell
 */
export const valuedSeries = (
  node: unknown,
  format: Types.MetricFormat,
  values: unknown[],
): Types.Series => ({
  labels: format.labels.flatMap(path => entriesAt(node, path)),
  y: [Words.VALUE],
  pointCount: values.length,
  cellsByKey: [
    ['time', Json.valuesAt(node, format.time)],
    [Words.VALUE, values],
  ],
})
