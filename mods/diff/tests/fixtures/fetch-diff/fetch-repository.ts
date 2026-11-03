import type Git from '../../../hooks/git'

/**
 * The repository the fetch cases run in: a plain checkout at `/repo`.
 */
export const FETCH_REPOSITORY: Git.Repository = {
  toplevel: '/repo',
  gitDir: '/repo/.git',
  commonDir: '/repo/.git',
}
