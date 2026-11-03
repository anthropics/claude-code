import type Entries from '../../entries'

/**
 * The docked list's window over its files: the rows in view, and how many
 * files lie above and below it.
 */
export type ListWindow = {
  shown: readonly Entries.BodyEntry[]
  above: number
  below: number
}
