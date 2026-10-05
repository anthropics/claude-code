import type { EventResult } from 'claude-code'

import Ranking from './ranking'

/**
 * Whether the run past the user tier holds over the chain's answer for the
 * organization's ceiling: the answer is over it, and that run is stricter.
 *
 * A run as permissive as the answer holds nothing, so the verdict returned
 * in the answer's place is never the looser of the two.
 *
 * @param answer what the whole chain settled on
 * @param held what the run past the user tier settled on
 * @param ceiling the question's `ceiling`, which the engine pins
 * @returns true when the run past the user tier is the answer
 */
export const isCeilingHeld = (
  answer: EventResult<'tool.check'>,
  held: EventResult<'tool.check'>,
  ceiling: string | undefined,
) => Ranking.isOverCeiling(answer, ceiling) && Ranking.isLooser(answer, held)
