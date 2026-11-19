import { calendarFieldsAt } from '../calendar-fields-at'
import Limits from '../limits'
import Records from '../records'
import type Types from '../types'

/**
 * Coarser fields are stated only where they change: `Sep 15 00:00`, `01:00`
 *
 * On an axis, a date alone means its midnight.
 *
 * @param instants the instants to label, in order
 * @param step the precision the labels are written to
 * @param labelling where the calendar is read, and what stands before
 * @returns one label for each instant
 */
export function timeLabels(
  instants: number[],
  step: Types.Step,
  labelling: Types.Labelling,
): string[] {
  const { fieldIndex } = step.unit
  const labels: string[] = []
  let known = labelling.fieldsBefore

  for (const ms of instants) {
    const fields = calendarFieldsAt(ms, labelling.zone)
    const [year, month, day, hour, minute, second] = fields
    const isNewYear = year !== known[Limits.YEAR]
    const hasDate =
      fieldIndex >= Limits.MONTH &&
      (fieldIndex <= Limits.DAY ||
        isNewYear ||
        month !== known[Limits.MONTH] ||
        day !== known[Limits.DAY])
    const hasYear = fieldIndex === Limits.YEAR || isNewYear
    const hasClock =
      fieldIndex > Limits.DAY &&
      !(
        labelling.areTicks &&
        hasDate &&
        hour === 0 &&
        minute === 0 &&
        second === 0
      )
    const parts: string[] = []

    if (hasDate) {
      const isByMonth = fieldIndex === Limits.MONTH
      parts.push(
        isByMonth
          ? `${Records.MONTHS[month]}`
          : `${Records.MONTHS[month]} ${day}`,
      )
    }

    if (hasYear) {
      parts.push(String(year))
    }

    if (hasClock) {
      const hasSeconds = fieldIndex === Limits.SECOND
      parts.push(
        (hasSeconds ? [hour, minute, second] : [hour, minute])
          .map(value => String(value).padStart(Limits.CLOCK_DIGITS, '0'))
          .join(':'),
      )
    }

    labels.push(parts.join(' '))
    known = fields
  }

  return labels
}
