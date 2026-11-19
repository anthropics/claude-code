import Lists from '../../../lists'
import Numbers from '../../../numbers'
import { barValueOf } from '../../bar-value-of'
import type Types from '../../types'
import { unitOf } from '../../unit-of'
import { UNKEYED } from '../../unkeyed'

/**
 * Sums every bar, drawn or not, into a last row that has no length.
 *
 * The sum is written in the format the drawn bars share.
 *
 * @param shownBars the bars that are drawn
 * @param allValues the value of every bar, drawn or not
 * @returns the row that closes the bars
 */
export const totalRowOf = (
  shownBars: Types.SizedSeries[],
  allValues: number[],
): Types.Bar => ({
  ...UNKEYED,
  name: 'total',
  stats: [
    [
      '',
      Numbers.formatValues(unitOf(shownBars), [Lists.sumOf(allValues)], {
        peers: shownBars.map(barValueOf),
      })[0] ?? '',
      '',
    ],
  ],
  relativeLength: 0,
})
