import { checkedProps } from './checked-props'
import type { Fields } from './fields'
import { isMarkKind } from './is-mark-kind'
import { isRecord } from './is-record'
import { markFieldsOf } from './mark-fields-of'
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
 * @returns the mark's row fields once the entry passes every check
 */
export function checkedMark(entry: unknown): Fields {
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

  if (kind === 'ok') {
    if (reason !== undefined) {
      throw refusal('reason: an ok mark carries none', 'mark')
    }

    return markFieldsOf({ kind, feature, props: checkedProps(props, 'mark') })
  }

  if (typeof reason !== 'string' || !TOKEN.test(reason)) {
    throw refusal(
      `reason: a ${kind} mark names why, a snake_case token`,
      'mark',
    )
  }

  return markFieldsOf({
    kind,
    feature,
    reason,
    props: checkedProps(props, 'mark'),
  })
}
