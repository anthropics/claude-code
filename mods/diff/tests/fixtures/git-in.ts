import type { ProcessRunResult } from 'claude-code'

import { NOT_A_REPOSITORY } from './not-a-repository.js'
import { REPOSITORY } from './repository.js'

/**
 * What git answers from a script of outputs by command-line key, REPOSITORY
 * when none is given.
 *
 * An invocation the script does not know fails as git does outside a
 * repository.
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

  return found
    ? { exitCode: 0, stdout: found[1], stderr: '' }
    : NOT_A_REPOSITORY
}
