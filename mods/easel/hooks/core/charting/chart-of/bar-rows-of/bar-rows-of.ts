import Lists from '../../../lists'
import Numbers from '../../../numbers'
import Shapes from '../../../shapes'
import { barValueOf } from '../../bar-value-of'
import { DEFAULT_INK } from '../../default-ink'
import Limits from '../../limits'
import type Types from '../../types'
import { unitOf } from '../../unit-of'
import { NEGATIVE_INK } from './negative-ink'

/**
 * Shares are stated only of a whole that has no part below zero.
 * Bars that are all zero are measured against 1, so each has a length of 0.
 *
 * The largest bar has the full length, in percent too: nothing tells a level up
 * to 100% from a rate of 0.5%.
 * A share goes last, painted quiet, so the value stands out.
 * Each measure has an ink, never red, or all have one where inks run out.
 *
 * @param shownBars the bars to draw, in the order they are drawn
 * @param allValues the value of every bar, drawn or not
 * @param options how the bars are to be read
 * @returns one row for each bar
 */
export function barRowsOf(
  shownBars: Types.SizedSeries[],
  allValues: number[],
  options: Types.BarRowsOptions,
): Types.Bar[] {
  const total = Lists.sumOf(allValues)
  const values = shownBars.map(barValueOf)
  const largestSize = Math.max(...shownBars.map(bar => bar.size))
  const fullLengthValue = largestSize === 0 ? 1 : largestSize
  const measureInks = Shapes.SERIES_INKS.filter(ink => ink !== NEGATIVE_INK)
  const hasInkPerMeasure = options.measures.length <= measureInks.length
  const inkByMeasure = new Map(
    hasInkPerMeasure ? Lists.zip(options.measures, measureInks) : [],
  )
  const hasShares =
    options.isSummed && total > 0 && allValues.every(value => value >= 0)
  const shareStats: Types.Stat[][] = hasShares
    ? Numbers.formatValues(
        '%',
        values.map(value => (Limits.PERCENT_OF_A_WHOLE * value) / total),
      ).map(percent => [['', '', percent]])
    : values.map(() => [])

  return Lists.zip(
    shownBars,
    Lists.zip(Numbers.formatValues(unitOf(shownBars), values), shareStats),
  ).map(([bar, [written, shareStat]]) => ({
    key: '',
    name: bar.name,
    stats: [['', written, ''], ...shareStat],
    ink:
      barValueOf(bar) < 0
        ? NEGATIVE_INK
        : (inkByMeasure.get(bar.measure) ?? DEFAULT_INK),
    relativeLength: barValueOf(bar) / fullLengthValue,
  }))
}
