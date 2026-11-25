import type Git from '../../../git'
import Names from '../../../names'
import type { ListPlace } from './list-place'

/**
 * The list's body as ReplDiffSidebarBody decides it: the empty state's
 * hint, the too-many state, an all-hidden state, or the session's rows.
 *
 * Strings are dim lines; rows are files to draw.
 *
 * @param place the fetch, its groups, the counts, the empty state
 * @returns the lines and rows, in order
 */
export function listBodyOf(
  place: ListPlace,
): readonly (string | Git.FileStat)[] {
  const { data, partition, totals, empty } = place

  const hint = empty?.hint ?? null

  if (empty) {
    return hint === null ? [] : [hint]
  }

  if (partition.shown.length === 0 && partition.unchecked.length > 0) {
    return [Names.uncheckedTextOf(place.isLoading)]
  }

  const isTooMany =
    data !== null &&
    data.files.length + partition.denied.length === 0 &&
    totals.filesCount > 0

  if (isTooMany) {
    return [
      'Too many changed files to show diff',
      'Per-file diff is skipped above 500 files',
    ]
  }

  const isOnlyNoise = partition.shown.length === 0 && partition.noiseCount > 0

  if (partition.shown.length === 0 && partition.denied.length > 0) {
    return isOnlyNoise
      ? [
          'Only hidden files changed',
          'Read-denied, test, and generated files are hidden in this panel',
        ]
      : [
          'Only read-denied files changed',
          'Read-denied files are hidden in this panel',
        ]
  }

  return isOnlyNoise
    ? [
        'Only tests and generated files changed',
        'Tests and generated files are hidden · click "show" above to view ' +
          'them',
      ]
    : partition.shown
}
