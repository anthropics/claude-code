import type { ParsedHunk } from './parsed-hunk.js'

/**
 * Whether each hunk starts where the one before it ended, on both sides:
 * the sub-hunks of one hunk split leave no line out and repeat none.
 *
 * @param parts the hunks in order
 * @returns true when they abut
 */
export const areContiguous = (parts: readonly ParsedHunk[]): boolean =>
  parts.slice(1).every((part, at) => {
    const before = parts[at]

    return (
      before !== undefined &&
      part.oldStart === before.oldStart + before.oldLines &&
      part.newStart === before.newStart + before.newLines
    )
  })
