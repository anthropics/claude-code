import type { SessionMessage } from 'claude-code'

import Git from '../../git'
import type Types from '../types'
import { fileEditOf } from './file-edit-of'
import { PREVIEW_CHARS } from './preview-chars'

/**
 * One turn's rows (its prompt first) as the files its tool calls edited,
 * as the built-in turn view reads them.
 *
 * A file edited twice keeps both calls' hunks (cut at MAX_LINES_PER_FILE
 * in all) and the summed counts, and one created then edited stays new.
 *
 * @param rows the prompt row through the last row before the next prompt
 * @param index the turn's number, from 1
 * @returns the turn; `files` empty when nothing was edited
 */
export function turnOf(
  rows: readonly SessionMessage[],
  index: number,
): Types.TurnDiff {
  const text = rows[0]?.text ?? ''
  const isShort = [...text].length <= PREVIEW_CHARS

  const preview = isShort
    ? text
    : `${[...text].slice(0, PREVIEW_CHARS - 1).join('')}…`

  const edits = rows
    .flatMap(row => (row.role === 'assistant' ? row.toolUses : []))
    .map(use => fileEditOf(use.result))
    .filter((edit): edit is Types.TurnFile => edit !== null)

  const byPath = new Map<string, Types.TurnFile>()

  for (const edit of edits) {
    const earlier = byPath.get(edit.path)

    byPath.set(
      edit.path,
      earlier
        ? {
            path: edit.path,
            hunks: [...earlier.hunks, ...edit.hunks],
            added: earlier.added + edit.added,
            removed: earlier.removed + edit.removed,
            isNewFile: earlier.isNewFile || edit.isNewFile,
            isTruncated: false,
          }
        : edit,
    )
  }

  const files = [...byPath.values()].map(file => ({
    ...file,
    ...Git.cutHunks(file.hunks),
  }))

  return { index, preview, files }
}
