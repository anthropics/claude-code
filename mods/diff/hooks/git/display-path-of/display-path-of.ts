import { renameDisplayOf } from '../rename-display-of'
import type Types from '../types'

/**
 * A row's name as the built-in lists it: the path, or for a rename the one
 * line `git diff --stat` prints for it (renameDisplayOf).
 *
 * @param file the row
 * @returns the name to draw and to sort by
 */
export function displayPathOf(
  file: Pick<Types.FileStat, 'path' | 'renamedFrom'>,
): string {
  const { renamedFrom, path } = file

  return renamedFrom === null ? path : renameDisplayOf(renamedFrom, path)
}
