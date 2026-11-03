import type Modes from '../modes'
import { modeChoiceOf } from './mode-choice-of.js'
import { NESTED_EVENT } from './nested-event.js'
import type { TelemetryRow } from './types'

/**
 * The row of a Read that attached nested AGENTS.md files: the mode and how
 * many it attached.
 *
 * @param mode the configured mode
 * @param fileCount the files attached to this Read's result
 * @returns the row to send
 */
export const nestedRowOf = (
  mode: Modes.Mode,
  fileCount: number,
): TelemetryRow => ({
  event: NESTED_EVENT,
  props: { mode: modeChoiceOf(mode), file_count: fileCount },
})
