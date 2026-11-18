import type { Fields } from '../../entries/fields/fields'

/**
 * One row waiting for its batch: the checked fields, and the id and time
 * it was logged with.
 */
export type PendingRow = {
  fields: Fields
  eventId: string
  loggedAt: string
}
