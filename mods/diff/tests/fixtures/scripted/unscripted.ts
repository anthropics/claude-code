import type { ProcessRunResult } from 'claude-code'

/**
 * What a scripted git answers for a command the script does not name: the
 * exit code git uses for a fatal error, and no output.
 */
export const UNSCRIPTED: ProcessRunResult = {
  exitCode: 128,
  stdout: '',
  stderr: '',
}
