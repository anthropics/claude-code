import type Modes from '../modes'
import { modeChoiceOf } from './mode-choice-of.js'
import { MODE_EVENT } from './mode-event.js'
import type { StartFacts, TelemetryRow } from './types'

/**
 * The `session.start` row: the configured mode, whether a person is at the
 * terminal, and under `claude` the two walk counts the nudge read.
 *
 * With the counts a project with AGENTS.md alone is told apart (some
 * AGENTS.md directories, no CLAUDE.md ones) where nothing is loaded.
 *
 * @param mode the configured mode
 * @param facts what the load knows at the start
 * @returns the row to send
 */
export const modeRowOf = (
  mode: Modes.Mode,
  facts: StartFacts,
): TelemetryRow => ({
  event: MODE_EVENT,
  props: {
    mode: modeChoiceOf(mode),
    is_interactive: facts.isInteractive,
    ...(facts.agentsFileCount !== undefined && {
      agents_file_count: facts.agentsFileCount,
    }),
    ...(facts.claudeFileCount !== undefined && {
      claude_file_count: facts.claudeFileCount,
    }),
  },
})
