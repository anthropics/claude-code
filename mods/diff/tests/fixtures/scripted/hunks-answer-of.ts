import type { PrintedFile } from './printed-file.js'
import { rawRecordOf } from './raw-record-of.js'

/**
 * What git prints for one hunks read: every file's raw record, an empty
 * field, then every file's patch under its opening line, in the order given.
 *
 * @param printed the changed files
 * @returns the child's standard output, empty when nothing changed
 */
export function hunksAnswerOf(printed: readonly PrintedFile[]) {
  const records = printed.map(([path]) => rawRecordOf(path))

  const patches = printed.map(
    ([path, body, opening = `diff --git a/${path} b/${path}`]) =>
      `${opening}\n${body}`,
  )

  const isEmpty = printed.length === 0

  return isEmpty ? '' : `${records.join('')}\0${patches.join('')}`
}
