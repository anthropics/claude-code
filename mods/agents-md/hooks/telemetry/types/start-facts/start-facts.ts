/**
 * What a fresh load knows at `session.start`: whether a person is at the
 * terminal, and under `claude` the nudge's two walk counts.
 *
 * The counts are the directories on the walk holding an AGENTS.md and those
 * holding a CLAUDE.md; absent under every other mode, which walks nothing at
 * the start.
 */
export type StartFacts = {
  isInteractive: boolean
  agentsFileCount?: number
  claudeFileCount?: number
}
