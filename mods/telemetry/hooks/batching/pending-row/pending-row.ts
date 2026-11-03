import type Entries from '../../entries'

/**
 * One row waiting for its batch: the checked fields, and the id and time
 * it was logged with.
 */
export type PendingRow = {
  fields: Entries.Fields
  eventId: string
  loggedAt: string
}
