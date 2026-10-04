import type Modes from '../modes'
import { modeChoiceOf } from './mode-choice-of.js'
import { MODE_EVENT } from './mode-event.js'
import type { TelemetryRow } from './types'

/**
 * The `session.start` row: the configured mode and whether a person is at
 * the terminal.
 *
 * @param mode the configured mode
 * @param isInteractive whether a person is at the terminal
 * @returns the row to send
 */
export const modeRowOf = (
  mode: Modes.Mode,
  isInteractive: boolean,
): TelemetryRow => ({
  event: MODE_EVENT,
  props: { mode: modeChoiceOf(mode), is_interactive: isInteractive },
})
