import { countOf } from '../../../count-of'
import type Git from '../../../git'

/**
 * A hunk's `@@ -a,b +c,d @@` header, its counts read off its lines, so a
 * cut or split hunk still parses: context counts on both sides.
 *
 * A side with no lines names the line before its start, as jsdiff's
 * formatPatch writes a structured hunk and the engine's parser reads back.
 *
 * @param hunk the hunk, its lines body lines only
 * @returns the header line
 */
export function hunkHeaderOf(hunk: Git.Hunk) {
  const oldLines = countOf(hunk.lines, line => !line.startsWith('+'))
  const newLines = countOf(hunk.lines, line => !line.startsWith('-'))
  const isOldEmpty = oldLines === 0
  const isNewEmpty = newLines === 0
  const oldStart = isOldEmpty ? Math.max(0, hunk.oldStart - 1) : hunk.oldStart
  const newStart = isNewEmpty ? Math.max(0, hunk.newStart - 1) : hunk.newStart

  return `@@ -${oldStart},${oldLines} +${newStart},${newLines} @@`
}
