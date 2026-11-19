import { calendarFieldsAt } from '../calendar-fields-at'
import { CALENDAR_UNITS } from '../calendar-units'
import Limits from '../limits'
import type Types from '../types'
import { FIELD_STARTS } from './field-starts'
import { isUnitNeededBy } from './is-unit-needed-by'

/**
 * Milliseconds count as seconds, the finest unit there is.
 *
 * @param instants the instants whose finest field is looked for
 * @param zone the IANA name of where the calendar is read
 * @returns a step of one of the finest unit that any of them needs
 */
export const precisionOf = (instants: number[], zone: string): Types.Step => ({
  unit:
    CALENDAR_UNITS.findLast(
      isUnitNeededBy(
        instants.map(ms =>
          calendarFieldsAt(ms, zone).findLastIndex(
            (value, index) => value !== FIELD_STARTS[index],
          ),
        ),
      ),
    ) ?? CALENDAR_UNITS[Limits.SECOND],
  count: 1,
  skipsWeekends: false,
})
