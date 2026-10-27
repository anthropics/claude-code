import type Types from '../types'

/**
 * A body with nothing to draw: an untracked or binary row's, or a staged
 * file's whose index body went stale on an unborn HEAD.
 */
export const EMPTY_FILE_HUNKS: Types.FileHunks = Object.freeze({
  hunks: [],
  isTruncated: false,
  isLarge: false,
})
