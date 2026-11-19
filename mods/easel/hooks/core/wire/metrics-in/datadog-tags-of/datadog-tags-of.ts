import Lists from '../../../lists'
import Limits from '../../limits'
import Patterns from '../../patterns'

/**
 * A label per tag, so the tags that all series share go to the title and
 * only those that differ name a series. Each keeps its key, as Datadog
 * shows it: `true` alone says nothing.
 *
 * A label is called `env tag`, which no column of a point is called.
 *
 * @param tags what narrows a series, as the service wrote it
 * @returns a record of the tags, or the text as it came when it is no plain
 *   and short list of tags with a key each
 */
export function datadogTagsOf(tags: unknown): unknown {
  const parts = typeof tags === 'string' ? tags.split(',') : []
  const isShort = parts.length <= Limits.MAX_TAGS_AS_LABELS
  const keys = isShort
    ? parts.map(part => Patterns.PLAIN_TAG.exec(part)?.[1])
    : []
  const isPlainList =
    keys.length > 0 &&
    !keys.includes(undefined) &&
    Lists.distinct(keys).length === keys.length

  return isPlainList
    ? Object.fromEntries(
        Lists.zip(
          keys.map(key => `${key} tag`),
          parts,
        ),
      )
    : tags
}
