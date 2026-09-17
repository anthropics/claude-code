import { NUDGE_EVENT } from './nudge-event.js'
import { NUDGE_OUTCOMES } from './nudge-outcomes.js'
import type { NudgeOutcome, TelemetryRow } from './types'

/**
 * The nudge's row: shown now, or acted on since.
 *
 * @param outcome what happened to the nudge
 * @returns the row to send
 */
export const nudgeRowOf = (outcome: NudgeOutcome): TelemetryRow => ({
  event: NUDGE_EVENT,
  props: { outcome: { value: outcome, of: NUDGE_OUTCOMES } },
})
