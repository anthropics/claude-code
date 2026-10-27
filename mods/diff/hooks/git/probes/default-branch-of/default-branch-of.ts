import Argv from '../../argv'
import type Types from '../../types'
import { CONVENTIONAL_DEFAULT_BRANCHES } from '../conventional-default-branches'

/**
 * The remote's default branch: what `origin/HEAD` names while that ref
 * resolves, else the first conventional name with a remote ref, else main.
 *
 * The engine's own default-branch confidence ladder, over `$.process.run`.
 *
 * @param run runs git
 * @returns the branch name, never empty
 */
export async function defaultBranchOf(run: Types.GitRun): Promise<string> {
  const hasRemoteRef = async (branch: string): Promise<boolean> =>
    (
      await run([
        Argv.NO_OPTIONAL_LOCKS,
        'show-ref',
        '--verify',
        '--quiet',
        `refs/remotes/origin/${branch}`,
      ])
    ).exitCode === 0

  const symref = await run([
    Argv.NO_OPTIONAL_LOCKS,
    'symbolic-ref',
    '--short',
    'refs/remotes/origin/HEAD',
  ])

  const named =
    symref.exitCode === 0 ? symref.stdout.trim().replace(/^origin\//, '') : ''

  if (named !== '' && (await hasRemoteRef(named))) {
    return named
  }

  for (const candidate of CONVENTIONAL_DEFAULT_BRANCHES) {
    if (await hasRemoteRef(candidate)) {
      return candidate
    }
  }

  return 'main'
}
