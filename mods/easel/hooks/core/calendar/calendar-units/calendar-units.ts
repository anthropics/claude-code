import Limits from '../limits'

/**
 * Year to second. `fieldIndex` repeats the index, so that it is a literal.
 */
export const CALENDAR_UNITS = [
  {
    fieldIndex: 0,
    typicalMs: Limits.DAYS_IN_TYPICAL_YEAR * Limits.DAY_MS,
    counts: [1, 2, 5, 10, 20, 50, 100],
  },
  {
    fieldIndex: 1,
    typicalMs: Limits.DAYS_IN_TYPICAL_MONTH * Limits.DAY_MS,
    counts: [1, 3, 6],
  },
  { fieldIndex: 2, typicalMs: Limits.DAY_MS, counts: [1, 2, 4, 7, 14] },
  { fieldIndex: 3, typicalMs: Limits.HOUR_MS, counts: [1, 2, 3, 6, 12] },
  { fieldIndex: 4, typicalMs: Limits.MINUTE_MS, counts: [1, 2, 5, 10, 15, 30] },
  {
    fieldIndex: 5,
    typicalMs: Limits.SECOND_MS,
    counts: [1, 2, 5, 10, 15, 30],
  },
] as const
