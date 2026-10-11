import type { TraceEntry } from 'claude-code'

import { isSameVerdict } from './is-same-verdict.js'
import Ranking from './ranking'

/**
 * The links of one run of `tool.check` that may hold a plugin a person
 * installed and that rewrote the verdict handed to them without tightening.
 *
 * A more permissive decision counts, and so does the same decision under
 * another reason, rule or hook. Read off `next.trace`, whose `tier` the
 * engine pins; a batch is named as the engine names it, its members joined.
 *
 * @param trace what settled beneath the hook on its latest `next` call
 * @returns their names, nearest the caller first; none when none rewrote
 */
export const rewrittenByUsers = (
  trace: readonly TraceEntry<'tool.check'>[],
): readonly string[] =>
  trace
    .filter((link, at) => {
      const handed = Ranking.handedTo(trace, at)

      return (
        Ranking.TIERS_HOLDING_USERS.includes(link.tier) &&
        link.returned !== undefined &&
        !Ranking.isLooser(handed, link.returned) &&
        !isSameVerdict(link.returned, handed)
      )
    })
    .map(link => link.plugin)
