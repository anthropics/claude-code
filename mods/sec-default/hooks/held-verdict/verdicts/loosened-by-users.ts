import type { TraceEntry } from 'claude-code'

import Ranking from './ranking'

/**
 * The links of one run of `tool.check` that may hold a plugin a person
 * installed and that answered more permissively than they were handed.
 *
 * Read off `next.trace`, whose `tier` the engine pins. A batch is named as
 * the engine names it, its members joined; whether a person's plugin did
 * the loosening is settled by the run past the user tier, never here.
 *
 * @param trace what settled beneath the hook on its latest `next` call
 * @returns their names, nearest the caller first; none when none loosened
 */
export const loosenedByUsers = (
  trace: readonly TraceEntry<'tool.check'>[],
): readonly string[] =>
  trace
    .filter(
      (link, at) =>
        Ranking.TIERS_HOLDING_USERS.includes(link.tier) &&
        Ranking.isLooser(link.returned, Ranking.handedTo(trace, at)),
    )
    .map(link => link.plugin)
