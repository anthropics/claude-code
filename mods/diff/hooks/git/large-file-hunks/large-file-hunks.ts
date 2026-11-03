import type Types from '../types'

/**
 * The body of a file whose diff text passed MAX_DIFF_BYTES: no hunks, and
 * the pane says the file is too large.
 */
export const LARGE_FILE_HUNKS: Types.FileHunks = Object.freeze({
  hunks: [],
  isTruncated: false,
  isLarge: true,
})
