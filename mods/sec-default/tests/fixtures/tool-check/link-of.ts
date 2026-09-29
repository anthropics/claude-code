import type { EventResult, Tier, TraceEntry } from 'claude-code'

import { CHECKED } from './checked.js'

/**
 * One settled link of a `tool.check` run as `next.trace` lists it: whose
 * hook, in which tier, and what it settled on (nothing when it was skipped).
 *
 * @param plugin the hook's plugin
 * @param tier the tier the engine pinned for it
 * @param returned what the link settled on
 * @returns the entry
 */
export const linkOf = (
  plugin: string,
  tier: Tier,
  returned?: EventResult<'tool.check'>,
): TraceEntry<'tool.check'> => ({
  index: 0,
  plugin,
  tier,
  event: 'tool.check',
  outcome: returned === undefined ? 'skipped' : 'returned',
  ms: 0,
  received: CHECKED,
  returned,
})
