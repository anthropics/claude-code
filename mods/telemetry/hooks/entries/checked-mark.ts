import { checkedProps } from './checked-props'
import type { Fields } from './fields'
import { isMarkKind } from './is-mark-kind'
import { isRecord } from './is-record'
import { markFieldsOf } from './mark-fields-of'
import { ownedBy } from './owned-by'
import { refusal } from './refusal'
import { TOKEN } from './token'

/**
 * The row's fields from one mark, or a refusal naming the first thing
 * wrong: the entry's shape, the feature, the kind, the reason, then props.
 *
 * Each property is checked in turn, as a log's are.
 *
 * @param entry the feature, kind, reason and properties as the caller passed
 *   them
 * @param pluginId the installed plugin the mark is for; none for a built-in
 * @returns the mark's row fields once the entry passes every check
 */
export function checkedMark(entry: unknown, pluginId?: string): Fields {
  if (!isRecord(entry)) {
    throw refusal('takes one entry, { feature, kind, reason?, props? }', 'mark')
  }

  const { feature, kind, reason, props = {} } = entry

  if (typeof feature !== 'string' || !TOKEN.test(feature)) {
    throw refusal('takes a feature name, a snake_case token', 'mark')
  }

  if (!isMarkKind(kind)) {
    throw refusal("kind: 'ok', 'sad' or 'bad'", 'mark')
  }

  if (kind === 'ok' && reason !== undefined) {
    throw refusal('reason: an ok mark carries none', 'mark')
  }

  const why = typeof reason === 'string' && TOKEN.test(reason) && reason

  if (kind !== 'ok' && why === false) {
    throw refusal(
      `reason: a ${kind} mark names why, a snake_case token`,
      'mark',
    )
  }

  const given = { name: feature, props: checkedProps(props, 'mark') }
  const owned =
    pluginId === undefined ? given : ownedBy(pluginId, given, 'mark')

  return markFieldsOf({
    kind,
    feature: owned.name,
    ...(why !== false && { reason: why }),
    props: owned.props,
  })
}
