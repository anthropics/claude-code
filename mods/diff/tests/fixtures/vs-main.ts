import type Git from '../../hooks/git'

/**
 * A branch comparison that resolved: main as the base, at a placeholder
 * merge-base ref.
 */
export const VS_MAIN: Git.DiffSource = {
  kind: 'branch',
  baseBranch: 'main',
  baseRef: 'x',
}
