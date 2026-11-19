import Json from '../../../../json'
import type Types from '../../../types'
import { datadogSeriesWith } from './datadog-series-with'
import { spacedPointsOf } from './spaced-points-of'

/**
 * A start that names no zone is no instant: its values are left out.
 *
 * @param node one expression of the server's answer, with its values or bins
 * @returns the series as Datadog's own format writes it, a time per value
 */
export const datadogMcpSeriesOf = (node: unknown): Types.DatadogSeries =>
  datadogSeriesWith(node, [
    ...spacedPointsOf(node),
    ...Json.valuesAt(node, 'binned.[]').map(bin => [
      Json.valuesAt(bin, 'start_time')[0],
      Json.valuesAt(bin, 'avg')[0],
    ]),
  ])
