import { arrayOf } from '../../../../array-of'
import type Git from '../../../../git'
import { isRecord } from '../../../../is-record'

/**
 * A tool result's `structuredPatch` as hunks, keeping only entries shaped
 * like one (numeric starts, string lines).
 *
 * @param patch the result's `structuredPatch` field
 * @returns the well-formed hunks; empty when the field is not an array
 */
export const hunksOf = (patch: unknown): Git.Hunk[] =>
  arrayOf(patch)
    .filter(isRecord)
    .flatMap(hunk => {
      const { oldStart, newStart, lines } = hunk

      const isHunk =
        typeof oldStart === 'number' &&
        typeof newStart === 'number' &&
        Array.isArray(lines)

      return isHunk
        ? [
            {
              oldStart,
              newStart,
              lines: arrayOf(lines).filter(
                (line): line is string => typeof line === 'string',
              ),
            },
          ]
        : []
    })
