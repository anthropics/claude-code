import type Types from '../types'
import { RENAME_RECORDS } from './rename-records'

/**
 * `git diff --numstat -z` output as totals over every row and the first
 * rows up to the cap; a binary file (`-` counts) is a 0/0 row marked binary.
 *
 * A record is `<added>\t<removed>\t<path>` ended by NUL, the path raw; a
 * rename is `<added>\t<removed>\t` then the old and the new path as the
 * next two records, kept as one row under the new path.
 *
 * @param stdout the command's standard output
 * @param maxFiles how many rows to keep
 * @returns the totals and the kept rows
 */
export function parseNumstat(
  stdout: string,
  maxFiles: number,
): Types.NumstatResult {
  const files: Types.FileStat[] = []
  const stats = { filesCount: 0, linesAdded: 0, linesRemoved: 0 }
  const records = stdout.split('\0')

  let at = 0

  while (at < records.length) {
    const [addedField, removedField, ...pathFields] = (records[at] ?? '').split(
      '\t',
    )

    const inline = pathFields.join('\t')
    const isRename = pathFields.length === 1 && inline === ''
    const renamedFrom = isRename ? (records[at + 1] ?? null) : null
    const path = isRename ? (records[at + 2] ?? '') : inline
    at += isRename ? RENAME_RECORDS : 1

    const isRow =
      addedField !== undefined && removedField !== undefined && path !== ''

    if (!isRow) {
      continue
    }

    const isBinary = addedField === '-' || removedField === '-'
    const added = isBinary ? 0 : Number(addedField) || 0
    const removed = isBinary ? 0 : Number(removedField) || 0

    stats.filesCount += 1
    stats.linesAdded += added
    stats.linesRemoved += removed

    if (files.length < maxFiles) {
      files.push({
        path,
        renamedFrom,
        added,
        removed,
        isBinary,
        isUntracked: false,
        isPreSession: false,
      })
    }
  }

  return { stats, files }
}
