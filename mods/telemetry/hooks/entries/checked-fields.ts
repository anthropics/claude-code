import { checkedProps } from './checked-props'
import { CORE_EVENT_PREFIX } from './core-event-prefix'
import type { Fields } from './fields'
import { fieldsOf } from './fields-of'
import { isRecord } from './is-record'
import { ownedBy } from './owned-by'
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
 * @param pluginId the installed plugin the row is for; none for a built-in
 * @returns the entry's checked event name and properties, as `Fields`
 */
export function checkedFields(entry: unknown, pluginId?: string): Fields {
  if (!isRecord(entry)) {
    throw refusal('takes one entry, { event, props? }')
  }

  const { event, props = {} } = entry

  if (typeof event !== 'string' || !TOKEN.test(event)) {
    throw refusal('takes an event name, a snake_case token')
  }

  if (pluginId === undefined) {
    return fieldsOf(event, checkedProps(props, 'log'))
  }

  if (event.startsWith(CORE_EVENT_PREFIX)) {
    throw refusal(
      `takes an event name with no ${CORE_EVENT_PREFIX} prefix; the row is ` +
        'named under this plugin',
    )
  }

  const owned = ownedBy(
    pluginId,
    { name: event, props: checkedProps(props, 'log') },
    'log',
  )

  return fieldsOf(CORE_EVENT_PREFIX + owned.name, owned.props)
}
