import Calendar from '../../../../calendar'
import Limits from '../../../limits'

/**
 * Finds the calendar year that holds the Thursday of an ISO week.
 *
 * @param year the week-numbering year
 * @param mondayOfJanuary the week's Monday, as a day of that year's January
 * @returns the calendar year of that week's Thursday
 */
export const yearOfThursday = (year: number, mondayOfJanuary: number): number =>
  Calendar.calendarFieldsAt(
    Calendar.wallClockMs([year, 0, mondayOfJanuary + Limits.THURSDAY - 1]),
    'UTC',
  )[0]
