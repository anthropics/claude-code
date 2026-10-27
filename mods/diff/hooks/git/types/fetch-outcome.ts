import type { DiffData } from './diff-data'

/**
 * How one fetch ended: outside any repository, unreadable for now (a lock, a
 * timeout, a rebase under way: the last good diff stays), or data.
 */
export type FetchOutcome =
  | { kind: 'no-repository' }
  | { kind: 'unavailable' }
  | { kind: 'data'; data: DiffData }
