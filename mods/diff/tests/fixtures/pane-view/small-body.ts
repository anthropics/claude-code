import type Git from '../../../hooks/git'

/**
 * A one-hunk body with a context line, a removal and an addition: enough
 * to draw the word highlight.
 */
export const SMALL_BODY: Git.FileHunks = {
  hunks: [{ oldStart: 1, newStart: 1, lines: [' ctx', '-old', '+new'] }],
  isTruncated: false,
  isLarge: false,
}
