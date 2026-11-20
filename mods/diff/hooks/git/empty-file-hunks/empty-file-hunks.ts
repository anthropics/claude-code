import type Types from '../types'

/**
 * A body with nothing to draw: a row that is never named to git gets it, and
 * so does a named path for which git prints no patch.
 */
export const EMPTY_FILE_HUNKS: Types.FileHunks = Object.freeze({
  hunks: [],
  isTruncated: false,
  isLarge: false,
})
