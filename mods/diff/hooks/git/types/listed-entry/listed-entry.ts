import type { EntryKind } from '../entry-kind'

/**
 * What a listing says of one entry: its own kind and, for a file, its
 * modification time in epoch milliseconds; 0 where the listing read none.
 */
export type ListedEntry = {
  kind: EntryKind
  mtimeMs: number
}
