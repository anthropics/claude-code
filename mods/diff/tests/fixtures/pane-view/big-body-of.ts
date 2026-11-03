import type Git from '../../../hooks/git'
import Limits from '../../../hooks/limits'
import { LONG_LINE_CHARS } from './long-line-chars.js'

/**
 * A body of one hunk at the line cap whose every line is long: more text
 * than the pane's whole body budget holds.
 *
 * @returns the body
 */
export const bigBodyOf = (): Git.FileHunks => ({
  hunks: [
    {
      oldStart: 0,
      newStart: 1,
      lines: Array.from(
        { length: Limits.MAX_LINES_PER_FILE },
        (_, at) => `+const value${at} = ${'0'.repeat(LONG_LINE_CHARS)}`,
      ),
    },
  ],
  isTruncated: false,
  isLarge: false,
})
