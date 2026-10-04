/**
 * What the first context of a load handed the engine, as counts.
 *
 * The AGENTS.md files added, the files they `@`-imported, their characters
 * in all, whether `claude-md-or-agents-md` stood down for a CLAUDE.md of the
 * project's own, and whether the walk threw so that nothing was found.
 */
export type LoadCounts = {
  fileCount: number
  importCount: number
  totalContentLength: number
  isYielded: boolean
  isWalkFailed: boolean
}
