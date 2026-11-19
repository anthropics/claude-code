import Flags from '../flags'
import Patterns from '../patterns'
import type Types from '../types'
import { unread } from '../unread'
import { EPOCH_SCALE_BY_DIGITS } from './epoch-scale-by-digits'
import { timeAt } from './time-at'
import { timeFromIsoWeek } from './time-from-iso-week'
import { timeFromParts } from './time-from-parts'
import { TIME_PATTERNS } from './time-patterns'

/**
 * Tries an epoch, then each spelling of a date, then an ISO week.
 *
 * @param cell what the table holds in one place
 * @returns the instant and whether a zone was named, a gap, or why not
 */
export function readTime(cell: Types.Cell): Types.TimeRead {
  const text = String(cell ?? '').trim()
  const isEmpty = Patterns.EMPTY_CELL.test(text)

  if (isEmpty) {
    return { kind: 'empty', why: 'empty' }
  }

  const epoch = Patterns.EPOCH_TEXT.test(text) ? Number(text) : NaN
  const msPerUnit = EPOCH_SCALE_BY_DIGITS[String(Math.trunc(epoch)).length]

  const isEpoch = !Number.isNaN(epoch) && msPerUnit !== undefined

  if (isEpoch) {
    return timeAt(epoch * msPerUnit, Flags.IS_ZONED)
  }

  for (const pattern of TIME_PATTERNS) {
    const groups = pattern.exec(text)?.groups

    if (groups) {
      return timeFromParts(groups)
    }
  }

  const weekGroups = Patterns.ISO_WEEK_PATTERN.exec(text)?.groups

  return weekGroups ? timeFromIsoWeek(weekGroups) : unread('not a time')
}
