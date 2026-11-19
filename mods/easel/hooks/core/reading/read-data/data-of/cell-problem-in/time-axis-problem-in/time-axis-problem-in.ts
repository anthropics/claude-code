import type Casting from '../../../../../casting'
import Cells from '../../../../../cells'
import type Refusal from '../../../../../refusal'
import type Types from '../../../../types'
import { quoted } from './quoted'

/**
 * A row whose time is empty or a text, such as a `Total` under the dates, is
 * only left out and counted.
 *
 * A number that is no time refuses the column: it shows a measure whose other
 * numbers only look like years.
 *
 * @param roles what each column is read as, for the name of the time column
 * @param reading the table as read, for the cells that hold no time
 * @returns the reason to refuse, or undefined
 */
export function timeAxisProblemIn(
  roles: Casting.Roles,
  reading: Types.TableReading,
): Refusal.Problem | undefined {
  const { unreadXCells } = reading
  const unreadDates = unreadXCells.filter(Cells.isLikeAnUnreadDate)
  const hasNoTime = reading.readings.length === 0
  const hasUnreadDates =
    unreadDates.length > 0 &&
    (hasNoTime || unreadDates.length === unreadXCells.length)

  if (hasUnreadDates) {
    return {
      code: 'dates_unread',
      why:
        `${roles.x} holds dates in a spelling that is not read ` +
        `(${quoted(unreadDates)}). ${Cells.TIME_SPELLINGS}`,
    }
  }

  const numbers = unreadXCells.filter(
    cell => Cells.readNumber(cell).kind === 'number',
  )
  const hasNumbers = numbers.length > 0

  if (hasNumbers) {
    return {
      code: 'x_not_times',
      why:
        `${roles.x} holds numbers that are not times (${quoted(numbers)}). ` +
        `A line, columns and sparks run over times. For one bar for each, ` +
        `pass form: "bars"`,
    }
  }

  const hasOnlyNames = hasNoTime && unreadXCells.length > 0

  return hasOnlyNames
    ? {
        code: 'x_not_times',
        why:
          `${roles.x} holds names, not times (${quoted(unreadXCells)}). A ` +
          `line, columns and sparks run over times: for names, pass form: ` +
          `"bars"`,
        fitsBars: true,
      }
    : undefined
}
