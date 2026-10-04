import type Git from '../../../hooks/git'

/**
 * A diff source that compares against the working tree, its base HEAD.
 */
export const WORKING_TREE: Git.DiffSource = {
  kind: 'working-tree',
  base: 'HEAD',
}
