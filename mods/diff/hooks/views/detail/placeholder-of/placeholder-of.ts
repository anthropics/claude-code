import type { DetailModel } from '../detail-model'
import { SAFE_PATHSPEC_PATTERN } from './safe-pathspec-pattern'

/**
 * The dim italic lines drawn instead of hunks (DiffDetailView's wording),
 * or null when the hunks draw.
 *
 * Untracked (the backend's note, its pasteable command only for a name of
 * letters, digits and `._/@+-`), binary, loading, unreadable, large, or
 * empty.
 *
 * @param detail the file
 * @returns the lines, or null
 */
export function placeholderOf(detail: DetailModel): readonly string[] | null {
  if (detail.isUntracked) {
    return detail.words.untrackedNoteOf(
      detail.path,
      SAFE_PATHSPEC_PATTERN.test(detail.path),
    )
  }

  if (detail.isBinary) {
    return ['Binary file - cannot display diff']
  }

  if (detail.body === undefined) {
    return ['Loading diff…']
  }

  if (detail.body === null) {
    return ['Diff unavailable']
  }

  const { isLarge, hunks } = detail.body
  const isEmpty = hunks.length === 0

  const note = isLarge
    ? 'Large file - diff exceeds 1 MB limit'
    : isEmpty
      ? 'No diff content'
      : null

  return note ? [note] : null
}
