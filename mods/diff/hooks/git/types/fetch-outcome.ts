import type { DiffData } from './diff-data'

/**
 * How one fetch ended: outside any repository, unreadable for now (a lock, a
 * timeout, a rebase under way: the last good diff stays), or data.
 *
 * `reason` is why, where a `vcs.diff` answer said: no older diff stays then.
 */
export type FetchOutcome =
  | { kind: 'no-repository' }
  | { kind: 'unavailable'; reason?: string }
  | { kind: 'data'; data: DiffData }
