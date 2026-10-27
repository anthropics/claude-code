import Argv from '../../argv'
import type Types from '../../types'

/**
 * The verdict for a merge-base that produced nothing: `none` when neither
 * ref of the default branch exists, else `error`.
 *
 * Only a probe that ran and exited non-zero is an authoritative miss; one
 * that answered 0 or never ran means the merge-base failure may pass.
 *
 * @param run runs git
 * @param defaultBranch the default branch's name
 * @returns `none` or `error`
 */
export async function missingBaseOf(
  run: Types.GitRun,
  defaultBranch: string,
): Promise<Types.BranchBase> {
  for (const ref of [
    `refs/remotes/origin/${defaultBranch}`,
    `refs/heads/${defaultBranch}`,
  ]) {
    const { exitCode } = await run([
      Argv.NO_OPTIONAL_LOCKS,
      'show-ref',
      '--verify',
      '--quiet',
      ref,
    ])

    const isPresentOrUnknown = exitCode === 0 || exitCode === -1

    if (isPresentOrUnknown) {
      return { kind: 'error', reason: 'merge_base_failed' }
    }
  }

  return { kind: 'none' }
}
