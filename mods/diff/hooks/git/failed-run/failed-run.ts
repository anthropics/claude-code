import type Types from '../types'

/**
 * What a child that never ran, was killed, or timed out reads as: exit code
 * -1 and no output, so a runner never rejects (GitRun).
 */
export const FAILED_RUN: Types.RunResult = Object.freeze({
  exitCode: -1,
  stdout: '',
  stderr: '',
})
