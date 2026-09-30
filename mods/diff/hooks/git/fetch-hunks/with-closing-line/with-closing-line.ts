import type Types from '../../types'

/**
 * A parsed body with one empty context row after its last hunk's lines, as
 * the built-in panel draws the empty line that closes git's output.
 *
 * The built-in reads every file's diff in one piece: the newline before the
 * next file's header parses as a context line of the file before it. A
 * body with no hunk, or one already cut, gains nothing.
 *
 * @param body the parsed body
 * @returns the body, its last hunk one row longer
 */
export function withClosingLine(body: Types.FileHunks): Types.FileHunks {
  const last = body.hunks.at(-1)
  const isClosed = last !== undefined && !body.isTruncated

  return isClosed
    ? {
        ...body,
        hunks: [
          ...body.hunks.slice(0, -1),
          { ...last, lines: [...last.lines, ' '] },
        ],
      }
    : body
}
