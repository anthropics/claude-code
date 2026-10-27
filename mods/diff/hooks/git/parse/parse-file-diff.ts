import Limits from '../../limits'
import { cutHunks } from '../cut-hunks'
import { hunkOf } from '../hunk-of'
import { LARGE_FILE_HUNKS } from '../large-file-hunks'
import type Types from '../types'
import { HUNK_HEADER } from './hunk-header'
import { isBodyLine } from './is-body-line'

/**
 * One file's unified `git diff` output as hunks, the body cut at
 * MAX_LINES_PER_FILE lines in all, as the built-in panel parses one file.
 *
 * Past MAX_DIFF_BYTES there are no hunks and `isLarge` is set; everything
 * before the first hunk header is the file's header.
 *
 * @param stdout the command's standard output for that one path
 * @returns the parsed body
 */
export function parseFileDiff(stdout: string): Types.FileHunks {
  if (stdout.length > Limits.MAX_DIFF_BYTES) {
    return LARGE_FILE_HUNKS
  }

  const rows = stdout.split('\n')

  const headerRows = rows.flatMap((row, at) =>
    HUNK_HEADER.test(row) ? [at] : [],
  )

  return {
    ...cutHunks(
      headerRows.map((at, ordinal) =>
        hunkOf(
          HUNK_HEADER.exec(rows[at] ?? '')?.groups,
          rows.slice(at + 1, headerRows[ordinal + 1]).filter(isBodyLine),
        ),
      ),
    ),
    isLarge: false,
  }
}
