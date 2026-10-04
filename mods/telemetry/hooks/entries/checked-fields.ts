import { checkedProps } from './checked-props'
import type { Fields } from './fields'
import { fieldsOf } from './fields-of'
import { isRecord } from './is-record'
import { refusal } from './refusal'
import { TOKEN } from './token'

/**
 * The row's fields from one entry, or a refusal naming the first thing
 * wrong: the entry's shape, the event, then each property in turn.
 *
 * Nothing is sent from an entry refused here: the row reaches the ingest as
 * written, so this check is the gate between the argument and the wire.
 *
 * @param entry the event's name and properties as the caller passed them
 * @returns the entry's checked event name and properties, as `Fields`
 */
export function checkedFields(entry: unknown): Fields {
  if (!isRecord(entry)) {
    throw refusal('takes one entry, { event, props? }')
  }

  const { event, props = {} } = entry

  if (typeof event !== 'string' || !TOKEN.test(event)) {
    throw refusal('takes an event name, a snake_case token')
  }

  return fieldsOf(event, checkedProps(props, 'log'))
}
