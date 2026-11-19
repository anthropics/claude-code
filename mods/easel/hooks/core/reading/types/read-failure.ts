import type Casting from '../../casting'
import type Refusal from '../../refusal'

/**
 * A refusal ends with a summary of `tables`.
 */
export type ReadFailure = {
  kind: 'refused'
  problem: Refusal.Problem
  tables: Casting.Table[]
}
