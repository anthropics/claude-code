import { CORE_EVENT_PREFIX } from '../core-event-prefix'
import { EVENT_PREFIX } from '../event-prefix'
import type { Fields } from '../fields'

/**
 * One checked entry as its fields: an event already named as the CLI's own
 * keeps its name, any other goes under the plugin prefix.
 *
 * @param event the event's name as the caller spelled it
 * @param props the properties as checked
 * @returns the entry's fields, the event name as sent and the props attached
 */
export const fieldsOf = (event: string, props: Fields['props']): Fields => ({
  name: event.startsWith(CORE_EVENT_PREFIX) ? event : EVENT_PREFIX + event,
  props,
})
