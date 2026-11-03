import type { ProcessRunResult } from 'claude-code'

import { NOT_A_REPOSITORY } from './not-a-repository.js'
import { REPOSITORY } from './repository.js'
import Scripted from './scripted'

/**
 * What git answers from a script of outputs by command-line key, REPOSITORY
 * when none is given.
 *
 * A hunks read (`--raw`) is answered for the paths it names from the bodies
 * the script holds under `-- <path>`; an invocation the script does not
 * know fails as git does outside a repository.
 *
 * @param argv the invocation, program first
 * @param script git's output for each invocation whose line holds the key
 * @returns git's exit code and output
 */
export function gitIn(
  argv: readonly string[],
  script: Readonly<Record<string, string>> = REPOSITORY,
): ProcessRunResult {
  const line = argv.join(' ')
  const found = Object.entries(script).find(([key]) => line.includes(key))
  const isHunksRead = argv.includes('--raw')

  const stdout = isHunksRead
    ? Scripted.hunksAnswerOf(
        argv
          .slice(argv.indexOf('--') + 1)
          .filter(path => Object.hasOwn(script, `-- ${path}`))
          .map(path => [path, script[`-- ${path}`] ?? '']),
      )
    : found?.[1]

  const isKnown = stdout !== undefined

  return isKnown ? { exitCode: 0, stdout, stderr: '' } : NOT_A_REPOSITORY
}
