import type { ProcessRunResult } from 'claude-code'

/**
 * What the plugin's git runner answers when the host rejected the spawn:
 * the timeout, a cancelled dispatch. No exit code git itself uses.
 */
export const GIT_TIMED_OUT: ProcessRunResult = {
  exitCode: -1,
  stdout: '',
  stderr: '',
}
