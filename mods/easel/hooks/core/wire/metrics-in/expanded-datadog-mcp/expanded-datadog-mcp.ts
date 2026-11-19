import Json from '../../../json'
import { datadogMcpSeriesOf } from './datadog-mcp-series-of'

/**
 * The Datadog MCP server gives a start, an interval and all values in one
 * text, or bins.
 *
 * @param root the parsed JSON of an answer
 * @returns the answer in Datadog's own format, or as it came when not such
 */
export function expandedDatadogMcp(root: unknown): unknown {
  const hasExpression = Json.valuesAt(root, '[].expression').length > 0

  return hasExpression
    ? {
        series: Json.valuesAt(root, '[]').map(node => datadogMcpSeriesOf(node)),
      }
    : root
}
