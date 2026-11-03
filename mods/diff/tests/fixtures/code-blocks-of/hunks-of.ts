import type { ParsedHunk } from './parsed-hunk.js'

/**
 * The hunks a unified-diff `Code` source holds, read as a surface reads
 * them.
 *
 * Each `@@ -a,b +c,d @@` header opens one and the lines under it are its
 * body; a source that opens with no header holds none.
 *
 * @param source the `Code` element's source
 * @returns the hunks in order
 */
export function hunksOf(source: string): ParsedHunk[] {
  const hunks: ParsedHunk[] = []

  for (const line of source.split('\n')) {
    const header = /^@@ -(\d+)(?:,(\d+))? \+(\d+)(?:,(\d+))? @@/.exec(line)
    const last = hunks.at(-1)

    if (header) {
      hunks.push({
        oldStart: Number(header[1]),
        oldLines: Number(header[2] ?? 1),
        newStart: Number(header[3]),
        newLines: Number(header[4] ?? 1),
        lines: [],
      })
    } else if (last) {
      hunks[hunks.length - 1] = { ...last, lines: [...last.lines, line] }
    } else {
      return []
    }
  }

  return hunks
}
