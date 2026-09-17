import type Modes from '../modes'
import { LOAD_EVENT } from './load-event.js'
import { modeChoiceOf } from './mode-choice-of.js'
import type { LoadCounts, TelemetryRow } from './types'

/**
 * The first-context row: the mode and what was handed to the engine, in
 * counts only; no path and no text.
 *
 * @param mode the configured mode
 * @param counts what the first context handed on
 * @returns the row to send
 */
export const loadRowOf = (
  mode: Modes.Mode,
  counts: LoadCounts,
): TelemetryRow => ({
  event: LOAD_EVENT,
  props: {
    mode: modeChoiceOf(mode),
    file_count: counts.fileCount,
    import_count: counts.importCount,
    total_content_length: counts.totalContentLength,
    yielded: counts.isYielded,
    walk_failed: counts.isWalkFailed,
  },
})
