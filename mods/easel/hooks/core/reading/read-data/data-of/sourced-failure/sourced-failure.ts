import Casting from '../../../../casting'
import type Refusal from '../../../../refusal'
import { readFailure } from '../../../read-failure'
import type Types from '../../../types'

/**
 * A refusal that opens with the source of the rows it is about, and
 * carries those rows for the summary.
 *
 * @param table the one table that was picked
 * @param problem the reason to refuse, as found in the rows
 * @returns the refusal, the same but for how its sentence opens
 */
export const sourcedFailure = (
  table: Casting.Table,
  problem: Refusal.Problem,
): Types.ReadFailure =>
  readFailure(
    {
      ...problem,
      why: `${Casting.shownSourceOf(table)}: ${problem.why}`,
    },
    [table],
  )
