import type { EventResult } from 'claude-code'

import { ceilingVerdict } from './ceiling-verdict'
import { LENIENCY } from './leniency'

/**
 * Whether a `tool.check` verdict is more permissive than the ceiling the
 * organization set on the tool: never where it set none.
 *
 * @param verdict what a run of the chain settled on
 * @param ceiling the question's `ceiling`, which the engine pins
 * @returns true when the verdict lets the call go further than the ceiling
 */
export const isOverCeiling = (
  verdict: EventResult<'tool.check'>,
  ceiling: string | undefined,
) =>
  ceiling !== undefined &&
  LENIENCY[verdict.decision] > LENIENCY[ceilingVerdict(ceiling)]
