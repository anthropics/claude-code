import type { ProcessRunResult } from 'claude-code'

/**
 * A probe that ran and found nothing: `rev-parse --verify` on an unborn
 * HEAD, `merge-base` with no common ancestor, `--is-ancestor` when not.
 */
export const PROBE_MISSED: ProcessRunResult = {
  exitCode: 1,
  stdout: '',
  stderr: '',
}
