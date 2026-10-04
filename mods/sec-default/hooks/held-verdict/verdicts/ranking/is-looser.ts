import type { EventResult } from 'claude-code'

import { LENIENCY } from './leniency'

/**
 * Whether a link's own verdict is more permissive than the one handed up to
 * it; with nothing handed up (it never called `next`), than a deny.
 *
 * A link that settled on nothing (skipped, rejected) loosened nothing.
 *
 * @param own what the link settled on
 * @param handed what settled beneath it and was handed up, if anything did
 * @returns true when the link loosened the verdict
 */
export const isLooser = (
  own: EventResult<'tool.check'> | undefined,
  handed: EventResult<'tool.check'> | undefined,
) =>
  own !== undefined &&
  LENIENCY[own.decision] > LENIENCY[handed?.decision ?? 'deny']
