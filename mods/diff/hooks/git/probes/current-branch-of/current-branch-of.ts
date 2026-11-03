import Argv from '../../argv'
import type Types from '../../types'

/**
 * The checked-out branch's name, or `HEAD` when detached or unreadable.
 *
 * @param run runs git
 * @returns the branch name
 */
export async function currentBranchOf(run: Types.GitRun): Promise<string> {
  const { exitCode, stdout } = await run([
    Argv.NO_OPTIONAL_LOCKS,
    'rev-parse',
    '--abbrev-ref',
    'HEAD',
  ])

  const name = stdout.trim()

  return exitCode === 0 && name !== '' ? name : 'HEAD'
}
