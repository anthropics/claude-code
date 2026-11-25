import type Types from '../types'
import { REBASE_MARKS } from './rebase-marks'
import { TRANSIENT_STATE_FILES } from './transient-state-files'

/**
 * Whether the repository is mid-merge, mid-rebase, mid-cherry-pick or
 * mid-revert, from a listing of the git directory.
 *
 * A state file counts only as a real file and a rebase's folder only as a
 * real directory, listed once more to tell a rebase's from `git am`'s; a
 * symbolic link by any of those names is never touched.
 *
 * @param entriesOf the host's directory listing
 * @param gitDir the repository's own git directory, absolute
 * @returns whether a state file, or a rebase's file beside its folder, is there
 */
export async function isTransient(
  entriesOf: Types.GitDeps['entriesOf'],
  gitDir: string,
): Promise<boolean> {
  const entries = await entriesOf(gitDir)
  const isStopped = entries?.get(REBASE_MARKS.head)?.kind === 'file'

  const isApplying =
    isStopped && entries?.get(REBASE_MARKS.apply)?.kind === 'dir'

  const applied = isApplying
    ? await entriesOf(`${gitDir}/${REBASE_MARKS.apply}`)
    : null

  const isRebasing =
    isStopped &&
    (entries?.get(REBASE_MARKS.merge)?.kind === 'dir' ||
      applied?.get(REBASE_MARKS.rebasing)?.kind === 'file')

  return (
    isRebasing ||
    TRANSIENT_STATE_FILES.some(file => entries?.get(file)?.kind === 'file')
  )
}
