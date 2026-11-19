import Calendar from '../../../calendar'
import Flags from '../../flags'
import Limits from '../../limits'
import type Types from '../../types'
import { unread } from '../../unread'
import { timeAt } from '../time-at'
import { daysSinceMonday } from './days-since-monday'
import { yearOfThursday } from './year-of-thursday'

/**
 * Turns the groups of a matched ISO week into the instant its day starts.
 *
 * A week belongs to the year of its Thursday, and most years have no week 53.
 *
 * @param parts the named groups of the match
 * @returns the instant, never zoned, or that there is no such week
 */
export function timeFromIsoWeek(parts: Types.MatchGroups): Types.TimeRead {
  const year = Number(parts.year)
  const week = Number(parts.week)
  const mondayOfJanuary =
    Limits.DAY_IN_FIRST_ISO_WEEK -
    daysSinceMonday(
      Calendar.wallClockMs([year, 0, Limits.DAY_IN_FIRST_ISO_WEEK]),
    ) +
    (week - 1) * Limits.DAYS_PER_WEEK
  const isMissingWeek =
    week < 1 || yearOfThursday(year, mondayOfJanuary) !== year

  return isMissingWeek
    ? unread('no such week')
    : timeAt(
        Calendar.wallClockMs([
          year,
          0,
          mondayOfJanuary + Number(parts.weekday ?? 1) - 1,
        ]),
        Flags.IS_ZONELESS,
      )
}
