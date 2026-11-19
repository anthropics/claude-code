import type Types from '../../types'

/**
 * Tells whether a legend shows as many different names as its rows have:
 * none that the cut made alike.
 *
 * @param distinctCount how many different names the rows have, uncut
 * @returns the test of one legend
 */
export const hasDistinctNames =
  (distinctCount: number) =>
  (legend: Types.Legend): boolean =>
    new Set(legend.shownNames.values()).size === distinctCount
