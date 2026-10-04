import type Types from '../types'
import { SHORTSTAT_PATTERN } from './shortstat-pattern'

/**
 * `git diff --shortstat` output as totals, or null when the line is not
 * git's summary line (empty output for an empty diff included).
 *
 * @param stdout the command's standard output
 * @returns the totals, or null
 */
export function parseShortstat(stdout: string): Types.DiffStats | null {
  const counts = SHORTSTAT_PATTERN.exec(stdout)?.groups

  if (!counts) {
    return null
  }

  return {
    filesCount: Number(counts.files),
    linesAdded: Number(counts.added ?? 0),
    linesRemoved: Number(counts.removed ?? 0),
  }
}
