import type Git from '../../hooks/git'

/**
 * Where every model and view fixture sits: a plain checkout at `/r` whose
 * git dir is its common dir.
 */
export const CHECKOUT: Git.Repository = {
  toplevel: '/r',
  gitDir: '/r/.git',
  commonDir: '/r/.git',
}
