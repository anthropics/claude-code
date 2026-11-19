import type Types from '../../../types'

/**
 * A spark says more than any stat beside it, so no stat outranks its lane.
 */
export const SPARK_LANE: Types.Lane = {
  minWidth: 16,
  statsBeforeNames: 0,
}
