import Json from '../../../json'
import Lists from '../../../lists'
import { entriesAt } from '../../entries-at'
import type Types from '../../types'

/**
 * Series with the same labels are one series to every later stage, whatever
 * the order their labels came in.
 *
 * @param root the parsed JSON of an answer
 * @param format the paths that lead to the series and to their labels
 * @returns how many series the labels of that format tell apart
 */
export const seriesToldApart = (
  root: unknown,
  format: Types.MetricFormat,
): number =>
  Lists.distinct(
    Json.valuesAt(root, format.series).map(node =>
      JSON.stringify(
        Object.entries(
          Object.fromEntries(
            format.labels.flatMap(path => entriesAt(node, path)),
          ),
        ).toSorted(),
      ),
    ),
  ).length
