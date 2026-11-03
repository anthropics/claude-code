import type Git from '../../../hooks/git'
import { TRACKED } from './tracked.js'

/**
 * A file row at a path: two added, one removed, tracked and in session,
 * unless the overrides say otherwise.
 *
 * @param path the row's path
 * @param overrides fields that differ from the ordinary row
 * @returns the row
 */
export const rowOf = (
  path: string,
  overrides: Partial<Git.FileStat> = {},
): Git.FileStat => ({
  path,
  renamedFrom: null,
  added: 2,
  removed: 1,
  ...TRACKED,
  ...overrides,
})
