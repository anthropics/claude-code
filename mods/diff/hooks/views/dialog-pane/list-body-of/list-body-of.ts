import type Git from '../../../git'
import type { ListPlace } from './list-place'

/**
 * The list's body as ReplDiffSidebarBody decides it: the empty state's
 * hint, the too-many state, the only-noise state, or the session's rows.
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

  const isTooMany =
    data !== null && data.files.length === 0 && totals.filesCount > 0

  if (isTooMany) {
    return [
      'Too many changed files to show diff',
      'Per-file diff is skipped above 500 files',
    ]
  }

  const isOnlyNoise = partition.shown.length === 0 && partition.noiseCount > 0

  return isOnlyNoise
    ? [
        'Only tests and generated files changed',
        'Tests and generated files are hidden · click "show" above to view ' +
          'them',
      ]
    : partition.shown
}
