import type { ProcessRunResult } from 'claude-code'

/**
 * How git fails in a directory outside any repository.
 */
export const NOT_A_REPOSITORY: ProcessRunResult = {
  exitCode: 128,
  stdout: '',
  stderr: 'fatal: not a git repository',
}
