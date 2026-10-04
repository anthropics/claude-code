import type { InstructionFile } from 'claude-code'

import type { LoadCounts } from './types'

/**
 * The first context's counts from the files it added: an entry with a parent
 * is an `@` import, one without is an AGENTS.md file.
 *
 * @param added the AGENTS.md instruction files handed to the engine, imports
 * among them
 * @param isYielded whether `claude-md-or-agents-md` stood down for a CLAUDE.md
 * @param isWalkFailed whether the walk threw
 * @returns the counts the load row and mark are built from
 */
export function loadCountsOf(
  added: readonly InstructionFile[],
  isYielded: boolean,
  isWalkFailed: boolean,
): LoadCounts {
  const importCount = added.reduce(
    (sum, file) => sum + (file.parent === undefined ? 0 : 1),
    0,
  )

  return {
    fileCount: added.length - importCount,
    importCount,
    totalContentLength: added.reduce(
      (sum, file) => sum + file.content.length,
      0,
    ),
    isYielded,
    isWalkFailed,
  }
}
