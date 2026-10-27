import Argv from '../../argv'
import type Types from '../../types'
import { isAbsolutePath } from '../is-absolute-path'
import { REPOSITORY_LINES } from '../repository-lines'

/**
 * The repository the session's directory is in, read with one `rev-parse`:
 * working tree top, git directory, common directory, all absolute.
 *
 * Exactly three absolute lines or nothing: a git too old for
 * `--path-format` echoes the flag as a line of its own, and such an answer
 * pins no repository rather than a wrong one.
 *
 * @param run runs git in the session's directory, nothing pinned yet
 * @returns the three absolute paths, or null outside a working tree
 */
export async function repositoryOf(
  run: Types.GitRun,
): Promise<Types.Repository | null> {
  const { exitCode, stdout } = await run([
    Argv.NO_OPTIONAL_LOCKS,
    'rev-parse',
    '--path-format=absolute',
    '--show-toplevel',
    '--git-dir',
    '--git-common-dir',
  ])

  const lines = stdout.split('\n').filter(line => line !== '')
  const [toplevel = '', gitDir = '', commonDir = ''] = lines

  const isResolved =
    exitCode === 0 &&
    lines.length === REPOSITORY_LINES &&
    lines.every(isAbsolutePath)

  return isResolved ? { toplevel, gitDir, commonDir } : null
}
