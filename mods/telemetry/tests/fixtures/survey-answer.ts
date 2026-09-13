import type { TelemetryLogEntry } from '../../types'

/**
 * A survey answered, as a plugin logs it: a number, a Choice and a
 * boolean.
 *
 * @returns the entry, fresh each call
 */
export const surveyAnswer = (): TelemetryLogEntry => ({
  event: 'survey_answered',
  props: {
    answer: 2,
    page: { value: 'ready', of: ['ready', 'later'] },
    seen: true,
  },
})
