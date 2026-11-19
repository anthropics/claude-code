import type Types from '../types'

/**
 * For rows that draw nothing between a name and its stats.
 */
export const NO_LANE: Types.Lane = { minWidth: 0, statsBeforeNames: 1 }
