import type { ListedEntry } from '../listed-entry'

/**
 * What a kind walk answers for a path: the listed entry; null when it
 * is absent, an ancestor is no real directory, or a listing failed.
 *
 * `over-budget` when the walk had spent its listings before reaching it.
 */
export type WalkEntry = ListedEntry | 'over-budget' | null
