import type Git from '../../../hooks/git'
import type PaneState from '../../../hooks/pane-state'

/**
 * The pane's read bodies holding one body under each of the given paths.
 *
 * @param body the body every path reads
 * @param paths the files that have it
 * @returns the bodies by path
 */
export const bodiesOf = (
  body: Git.FileHunks,
  ...paths: readonly string[]
): PaneState.Bodies => new Map(paths.map(path => [path, body]))
