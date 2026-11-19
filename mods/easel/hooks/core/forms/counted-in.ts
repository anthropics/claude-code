import { FORMS } from './forms'
import type Types from './types'

/**
 * A number of things with the noun their chart gives them: "1 bar",
 * "1,200 series".
 *
 * @param form the form of the chart
 * @param count how many there are
 * @returns the number, its digits grouped, and the noun
 */
export function countedIn(form: keyof typeof FORMS, count: number): string {
  const { plural, singular = plural }: Types.Form = FORMS[form]

  return `${count.toLocaleString('en-US')} ${count === 1 ? singular : plural}`
}
