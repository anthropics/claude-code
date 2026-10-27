import type { ProcessRunResult } from 'claude-code'

import type Git from '../../../hooks/git'
import type { ScriptedGit } from './scripted-git.js'
import { UNSCRIPTED } from './unscripted.js'

/**
 * A git answering from a script: the first entry whose pattern the joined
 * argv contains, UNSCRIPTED otherwise; every argv is kept in order.
 *
 * @param script pattern to result
 * @returns the runner and the argvs it saw
 */
export function scriptedGitOf(
  script: Readonly<Record<string, ProcessRunResult>>,
): ScriptedGit {
  const argvs: (readonly string[])[] = []

  const run: Git.GitRun = argv => {
    argvs.push(argv)

    const line = argv.join(' ')

    const scripted = Object.entries(script).find(([pattern]) =>
      line.includes(pattern),
    )

    return Promise.resolve(scripted?.[1] ?? UNSCRIPTED)
  }

  return { run, argvs }
}
