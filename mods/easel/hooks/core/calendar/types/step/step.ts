import type { CALENDAR_UNITS } from '../../calendar-units'

/**
 * One day that `skipsWeekends` goes from a Friday to the Monday.
 */
export type Step = {
  unit: (typeof CALENDAR_UNITS)[number]
  count: number
  skipsWeekends: boolean
}
