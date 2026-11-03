import type Types from '../../../types'

/**
 * No rows and zero totals: what an unborn HEAD shows when even
 * `git diff --cached` could not be read.
 */
export const EMPTY_NUMSTAT: Types.NumstatResult = Object.freeze({
  stats: Object.freeze({ filesCount: 0, linesAdded: 0, linesRemoved: 0 }),
  files: Object.freeze([]),
})
