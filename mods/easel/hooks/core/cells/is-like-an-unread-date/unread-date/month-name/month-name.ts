import Calendar from '../../../../calendar'

/**
 * A month by its first three letters, with any lower-case rest of the word.
 */
export const MONTH_NAME = `(?:${Calendar.MONTHS.join('|')})[a-z]*`
