import type { EntryKind } from '../entry-kind'

/**
 * What a kind walk answers for a path: the entry's own kind; null when it
 * is absent, an ancestor is no real directory, or a listing failed.
 *
 * `over-budget` when the walk had spent its listings before reaching it.
 */
export type WalkKind = EntryKind | 'over-budget' | null
