import Limits from '../../../limits'
import { EMPTY_FILE_HUNKS } from '../../empty-file-hunks'
import type Types from '../../types'
import { FILE_HEADER_START } from '../file-header-start'
import { isWholeListing } from '../is-whole-listing'
import { parseFileDiff } from '../parse-file-diff.js'
import { QUOTED_HEADER_START } from '../quoted-header-start'
import { UNMERGED_STATUS } from '../unmerged-status'

/**
 * The bodies one `git diff --raw -z -p` answer settles, by path: each file's
 * patch parsed as one file's, under the name git listed for it.
 *
 * The n-th patch is the n-th NUL-ended name's, unmerged names having none and
 * neighbours under one opening line being one file; an unquoted opening line
 * must equal its name's. Where the host cut, a file waits unless large.
 *
 * @param stdout the child's standard output
 * @param asked the paths the child was asked for
 * @returns the settled bodies; none where names and patches disagree
 */
export function parseFileDiffs(
  stdout: string,
  asked: readonly string[],
): ReadonlyMap<string, Types.FileHunks> {
  const fields = stdout.split('\0')

  const patchAt = fields.findIndex(
    (field, at) => at % 2 === 0 && !field.startsWith(':'),
  )

  const listed = fields
    .slice(0, patchAt)
    .filter(
      (_, at) => at % 2 === 1 && !fields[at - 1]?.endsWith(UNMERGED_STATUS),
    )

  const isParted = fields[patchAt] === ''

  const rows = fields
    .slice(patchAt + (isParted ? 1 : 0))
    .join('\0')
    .split('\n')

  const opened = rows.flatMap((row, at) =>
    row.startsWith(FILE_HEADER_START) ? [at] : [],
  )

  const starts = opened.filter(
    (at, nth) => rows[at] !== rows[opened[nth - 1] ?? -1],
  )

  const isWhole = isWholeListing(stdout, '\n')

  const arrived = starts
    .map((start, nth) => {
      const end = starts[nth + 1]
      const path = listed[nth] ?? ''
      const isLast = end === undefined

      return {
        path,
        isNamed:
          rows[start]?.startsWith(QUOTED_HEADER_START) === true ||
          rows[start] === `${FILE_HEADER_START}a/${path} b/${path}`,
        isCut: isLast && !isWhole,
        text: rows.slice(start, end).join('\n') + (isLast ? '' : '\n'),
      }
    })
    .filter(patch => !patch.isCut || patch.text.length > Limits.MAX_DIFF_BYTES)

  const isPaired =
    patchAt !== -1 &&
    starts.length <= listed.length &&
    (starts.length === listed.length || starts.length === 0 || !isWhole) &&
    arrived.every(patch => patch.isNamed)

  if (!isPaired) {
    return new Map()
  }

  const read = new Map(
    arrived.map(patch => [patch.path, parseFileDiff(patch.text)]),
  )

  const waiting = isWhole ? [] : listed.slice(arrived.length)

  return new Map(
    asked
      .filter(path => !waiting.includes(path))
      .map(path => [path, read.get(path) ?? EMPTY_FILE_HUNKS]),
  )
}
