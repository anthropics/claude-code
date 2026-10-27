import type { NumstatResult } from './numstat-result'

/**
 * A tier's rows once the untracked files were merged in, and whether git
 * withheld their listing (failed, timed out, cut).
 *
 * Withheld: the rows are the tracked ones alone, as the built-in degrades,
 * and the pane says so.
 */
export type MergedResult = NumstatResult & { isUntrackedWithheld: boolean }
