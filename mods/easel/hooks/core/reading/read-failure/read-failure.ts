import type Casting from '../../casting'
import type Refusal from '../../refusal'
import type Types from '../types'

/**
 * A refusal that summarizes nothing unless it is given what to summarize.
 *
 * @param problem the reason: its code, and the sentence the model reads
 * @param tables what the refusal summarizes
 * @returns the refusal
 */
export const readFailure = (
  problem: Refusal.Problem,
  tables: Casting.Table[] = [],
): Types.ReadFailure => ({
  kind: 'refused',
  problem,
  tables,
})
