import type { TraceEntry } from 'claude-code'

import Ranking from './ranking'

/**
 * The plugins a person installed that loosened the verdict in one run of
 * `tool.check`: each answered more permissively than it was handed.
 *
 * Read off `next.trace`, whose `tier` the engine pins. A link that passed a
 * verdict on, tightened it, or was skipped is not named.
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
        link.tier === 'user' &&
        Ranking.isLooser(link.returned, Ranking.handedTo(trace, at)),
    )
    .map(link => link.plugin)
