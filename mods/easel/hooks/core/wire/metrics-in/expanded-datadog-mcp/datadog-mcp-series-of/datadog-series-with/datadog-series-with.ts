import Json from '../../../../../json'
import type Types from '../../../../types'

/**
 * One expression of the server's answer as Datadog's own format writes a
 * series, around points that are already made.
 *
 * @param node one expression of the answer, with its name and its scope
 * @param pointlist a time and a value per point
 * @returns the series
 */
export const datadogSeriesWith = (
  node: unknown,
  pointlist: unknown[][],
): Types.DatadogSeries => ({
  metric: Json.valuesAt(node, 'expression')[0],
  scope: Json.valuesAt(node, 'scope')[0],
  pointlist,
})
