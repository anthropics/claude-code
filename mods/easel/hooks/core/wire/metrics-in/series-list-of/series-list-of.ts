import Json from '../../../json'
import type Types from '../../types'
import { inUnit } from './in-unit'
import { unitAt } from './unit-at'
import { valuedSeries } from './valued-series'

/**
 * Reads an answer as one format writes it: every series the paths of that
 * format reach, each cell with the unit its series states.
 *
 * @param expandedRoot the parsed JSON of an answer, values already spread
 * @param format the paths that lead to the series and into each of them
 * @returns the series found, none when the answer is not in that format
 */
export const seriesListOf = (
  expandedRoot: unknown,
  format: Types.MetricFormat,
): Types.Series[] =>
  Json.valuesAt(expandedRoot, format.series).map(node =>
    valuedSeries(
      node,
      format,
      Json.valuesAt(node, format.value).map(inUnit(unitAt(node, format))),
    ),
  )
