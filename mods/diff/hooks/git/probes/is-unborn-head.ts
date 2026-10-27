import Argv from '../argv'
import type Types from '../types'

/**
 * Whether HEAD is unborn (a repository before its first commit): only a
 * `rev-parse --verify HEAD` that ran and exited exactly 1 says so.
 *
 * A fatal repository error (128) or a killed probe proves nothing, as for
 * the built-in panel's no-commits probe.
 *
 * @param run runs git
 * @returns whether the probe exited 1
 */
export async function isUnbornHead(run: Types.GitRun): Promise<boolean> {
  const { exitCode } = await run([
    Argv.NO_OPTIONAL_LOCKS,
    'rev-parse',
    '--verify',
    '--quiet',
    'HEAD',
  ])

  return exitCode === 1
}
