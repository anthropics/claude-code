import Json from '../../../json'
import Lists from '../../../lists'
import Limits from '../../limits'
import Words from '../../words'
import { datadogTagsOf } from '../datadog-tags-of'
import { groupedSeries } from './grouped-series'

/**
 * Only Datadog's own format has a `pointlist`: any other answer is left.
 *
 * A filter becomes labels only where every filter of the answer can, or one
 * series would have labels and the next a text. Every point gets a copy of
 * every label, so all the series together may have a few.
 *
 * @param root the parsed JSON of an answer
 * @returns the answer, each series of Datadog's with its tags as labels
 */
export function groupedDatadog(root: unknown): unknown {
  const isDatadog =
    Json.isRecord(root) && Json.valuesAt(root, 'series.[].pointlist').length > 0

  if (!isDatadog) {
    return root
  }

  const series = Json.valuesAt(root, 'series.[]').map(groupedSeries)
  const tagged = series.map(node =>
    Json.isRecord(node) ? { ...node, scope: datadogTagsOf(node.scope) } : node,
  )
  const scopes = Json.valuesAt(tagged, '[].scope')
  const areAllTags =
    scopes.every(scope => scope === Words.NO_SCOPE || Json.isRecord(scope)) &&
    Lists.distinct(
      scopes.flatMap(scope => (Json.isRecord(scope) ? Object.keys(scope) : [])),
    ).length <= Limits.MAX_TAGS_AS_LABELS

  return { ...root, series: areAllTags ? tagged : series }
}
