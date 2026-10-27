import type Types from '../types'

/**
 * One hunk from its header's captured starts and its body lines.
 *
 * @param starts the `old` and `new` groups of HUNK_HEADER, when it matched
 * @param lines the body lines after the header
 * @returns the hunk
 */
export const hunkOf = (
  starts: Record<string, string> | undefined,
  lines: readonly string[],
): Types.Hunk => ({
  oldStart: Number(starts?.old),
  newStart: Number(starts?.new),
  lines,
})
