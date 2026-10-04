import { countOf } from '../../../count-of'
import { isRecord } from '../../../is-record'
import type Types from '../../types'
import { hunksOf } from './hunks-of'

/**
 * One Edit or Write result as the file it changed, told as the built-in
 * turn view tells an edit result; null for any other result.
 *
 * A `filePath` with a non-empty `structuredPatch`, or a `create` with its
 * `content`, which becomes one all-`+` hunk.
 *
 * @param result what the transcript stored for the tool call
 * @returns the file's edit, or null
 */
export function fileEditOf(result: unknown): Types.TurnFile | null {
  if (!isRecord(result) || typeof result.filePath !== 'string') {
    return null
  }

  const hunks = hunksOf(result.structuredPatch)
  const isNewFile = result.type === 'create'

  if (hunks.length > 0) {
    const lines = hunks.flatMap(hunk => hunk.lines)

    return {
      path: result.filePath,
      hunks,
      added: countOf(lines, line => line.startsWith('+')),
      removed: countOf(lines, line => line.startsWith('-')),
      isNewFile,
      isTruncated: false,
    }
  }

  if (!isNewFile || typeof result.content !== 'string') {
    return null
  }

  const created = result.content.split('\n')

  return {
    path: result.filePath,
    hunks: [
      { oldStart: 0, newStart: 1, lines: created.map(line => `+${line}`) },
    ],
    added: created.length,
    removed: 0,
    isNewFile: true,
    isTruncated: false,
  }
}
