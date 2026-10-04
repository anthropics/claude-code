import type Git from '../../../git'
import { hunkHeaderOf } from '../hunk-header-of'

/**
 * A hunk as unified-diff text: its header (hunkHeaderOf), then its lines.
 *
 * @param hunk the hunk, its lines body lines only
 * @returns the text, no trailing newline
 */
export const hunkSourceOf = (hunk: Git.Hunk) =>
  [hunkHeaderOf(hunk), ...hunk.lines].join('\n')
