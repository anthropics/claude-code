import type { TraceEntry } from 'claude-code'

import Ranking from '../ranking'

/**
 * The links of one run of `tool.check` that may hold a plugin a person
 * installed and that answered more permissively than they were handed.
 *
 * Read off `next.trace`, whose `tier` the engine pins.
 *
 * @param trace what settled beneath the hook on its latest `next` call
 * @returns the links, nearest the caller first; none when none loosened
 */
export const loosenedLinks = (trace: readonly TraceEntry<'tool.check'>[]) =>
  trace.filter(
    (link, at) =>
      Ranking.TIERS_HOLDING_USERS.includes(link.tier) &&
      Ranking.isLooser(link.returned, Ranking.handedTo(trace, at)),
  )
