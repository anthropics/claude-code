import Json from '../../../../json'
import Patterns from '../../../patterns'
import Words from '../../../words'

/**
 * Sets apart what narrows the whole query from what tells its series apart.
 *
 * Datadog mixes the tags a series was split by (`tag_set`) into its scope,
 * among the filter. Its MCP server states the whole query as the metric, and
 * as scope only those tags.
 *
 * @param node one series of Datadog's own format
 * @returns the series with a filter and a group, or as it came where its
 *   scope is no text
 */
export function groupedSeries(node: unknown): unknown {
  const [scope] = Json.valuesAt(node, 'scope')
  const isRead = Json.isRecord(node) && typeof scope === 'string'

  if (!isRead) {
    return node
  }

  const [query, metric, filter, functions] =
    Patterns.ONE_METRIC_EXPRESSION.exec(String(node.metric)) ?? []
  const isQuery = query !== undefined
  const groupTags = new Set(
    isQuery ? scope.split(',') : Json.valuesAt(node, 'tag_set.[]').map(String),
  )
  groupTags.delete(Words.NO_SCOPE)

  return {
    ...node,
    metric: isQuery ? metric : node.metric,
    scope:
      (isQuery ? (filter ?? '') : scope)
        .split(',')
        .filter(part => !groupTags.has(part))
        .join(',') || Words.NO_SCOPE,
    group: [...groupTags].join(',') || undefined,
    functions: functions || undefined,
  }
}
