import Texts from '../../texts'
import Limits from '../limits'
import Records from '../records'
import type Types from '../types'
import { COUNT_LADDER } from './count-ladder'
import { decimalsOnMultiple } from './decimals-on-multiple'
import { MONEY_LADDER } from './money-ladder'
import { UNIT_LADDERS } from './unit-ladders'

/**
 * Picks how a group of numbers is written, from what they count and how large.
 *
 * The multiple is the largest the numbers reach that keeps their decimals
 * few: 61s, not 1.017min.
 *
 * @param unit What the values count: a known suffix, a currency sign or a word.
 * @param values The values that will share the format, in base units.
 * @returns The format that writes all of them alike.
 */
export function numberFormatFor(
  unit: string,
  values: number[],
): Types.NumberFormat {
  const ownLadder = UNIT_LADDERS.find(ladder => Object.hasOwn(ladder, unit))
  const isMoney = Records.CURRENCY_SIGNS.includes(unit)
  const ladder = ownLadder ?? (isMoney ? MONEY_LADDER : COUNT_LADDER)
  const largest = Math.max(...values.map(Math.abs))
  const decimalsOn = decimalsOnMultiple(
    largest,
    Math.max(...values) - Math.min(...values),
    isMoney,
  )
  const reached = Object.entries(ladder).filter(
    ([, size], index) => index === 0 || size <= (largest === 0 ? 1 : largest),
  )
  const [suffix, size] = reached
    .filter(([, size]) => decimalsOn(size) <= Limits.MAX_DECIMALS_ON_A_MULTIPLE)
    .at(-1) ??
    reached.at(-1) ?? ['', 1]
  const isWord = ladder === COUNT_LADDER && unit !== ''
  const word = isWord
    ? ` ${Texts.truncateMiddle(unit, Limits.MAX_UNIT_WIDTH)}`
    : ''

  return {
    multiplesPerUnit: 1 / size,
    before: isMoney ? unit : '',
    after: `${suffix}${word}`,
    afterZero: ownLadder ? suffix : word,
    decimals: decimalsOn(size),
  }
}
