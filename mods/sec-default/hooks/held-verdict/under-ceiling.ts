import type { EventResult } from 'claude-code'

import Verdicts from './verdicts'

/**
 * What the `tool.check` hook's failure handler answers on a tool under an
 * organization's ceiling: its verdict when within the ceiling, else that.
 *
 * No verdict stays none, so a run that rejected still fails the call. Where
 * the organization set no ceiling the verdict passes as it is.
 *
 * @param caught the verdict the handler would return, if it has one
 * @param ceiling the question's `ceiling`, which the engine pins
 * @returns the verdict the handler returns
 */
export function underCeiling(
  caught: EventResult<'tool.check'> | undefined,
  ceiling: string | undefined,
) {
  const isOver =
    caught !== undefined &&
    ceiling !== undefined &&
    Verdicts.isOverCeiling(caught, ceiling)

  return isOver ? Verdicts.uncheckedCeiling(ceiling) : caught
}
