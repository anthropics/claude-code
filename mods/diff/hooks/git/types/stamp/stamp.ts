/**
 * A file's date behind a kind walk: its modification time; null when it is
 * no real file under real directories or cannot be read.
 *
 * `over-budget` when the walk's listings ran out before reaching it.
 */
export type Stamp = number | 'over-budget' | null
