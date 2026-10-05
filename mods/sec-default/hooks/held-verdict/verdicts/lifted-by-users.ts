import type { TraceEntry } from 'claude-code'

import { loosenedLinks } from './loosened-links'
import Ranking from './ranking'

/**
 * The links of one run of `tool.check` that may hold a plugin a person
 * installed and that answered over the organization's ceiling on the tool.
 *
 * A link that loosened the verdict it was handed and stayed within the
 * ceiling is not among them. Read off `next.trace`, to name who is told.
 *
 * @param trace what settled beneath the hook on its latest `next` call
 * @param ceiling the question's `ceiling`, which the engine pins
 * @returns their names, nearest the caller first; none under no ceiling
 */
export const liftedByUsers = (
  trace: readonly TraceEntry<'tool.check'>[],
  ceiling: string | undefined,
): readonly string[] =>
  loosenedLinks(trace)
    .filter(
      link =>
        link.returned !== undefined &&
        Ranking.isOverCeiling(link.returned, ceiling),
    )
    .map(link => link.plugin)
