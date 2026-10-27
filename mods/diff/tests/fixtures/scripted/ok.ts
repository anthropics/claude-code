import type { ProcessRunResult } from 'claude-code'

/**
 * A scripted git answer that exited 0 with the given output, nothing on
 * stderr.
 *
 * @param stdout what the command printed; nothing by default
 * @returns the run result
 */
export const ok = (stdout = ''): ProcessRunResult => ({
  exitCode: 0,
  stdout,
  stderr: '',
})
