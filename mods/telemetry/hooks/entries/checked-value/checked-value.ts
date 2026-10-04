import { CHOICE_TOKEN } from '../choice-token'
import { CHOICES_LIMIT } from '../choices-limit'
import { isRecord } from '../is-record'
import type { Method } from '../method'
import { refusal } from '../refusal'

/**
 * One property's value as it goes into the metadata: a finite number, a
 * boolean, or a Choice's value chosen from its token list.
 *
 * A bare string is refused: free text never reaches the row.
 *
 * @param key the property's key, named in a refusal
 * @param value what the caller passed under it
 * @param method the method the property was passed to, named in a refusal
 * @returns the value as stored: the boolean or finite number unchanged, or the
 *          chosen member when value is a Choice
 */
export function checkedValue(
  key: string,
  value: unknown,
  method: Method = 'log',
): string | number | boolean {
  if (typeof value === 'boolean') {
    return value
  }

  if (typeof value === 'number') {
    if (Number.isFinite(value)) {
      return value
    }

    throw refusal(`props.${key}: a number is finite`, method)
  }

  if (typeof value === 'string') {
    throw refusal(
      `props.${key}: free text is refused; a string is a Choice, ` +
        `{ value, of: [...] }`,
      method,
    )
  }

  if (!isRecord(value) || !Array.isArray(value.of)) {
    throw refusal(
      `props.${key}: a value is a finite number, a boolean, or a Choice, ` +
        `{ value, of: [...] }`,
      method,
    )
  }

  const members = value.of
  const chosen = value.value

  const isTokenList =
    members.length > 0 &&
    members.length <= CHOICES_LIMIT &&
    members.every(
      member => typeof member === 'string' && CHOICE_TOKEN.test(member),
    )

  if (!isTokenList) {
    throw refusal(
      `props.${key}.of: a list of 1 to ${CHOICES_LIMIT} ` + `lowercase tokens`,
      method,
    )
  }

  if (typeof chosen !== 'string' || !members.includes(chosen)) {
    throw refusal(`props.${key}.value: one of the members of \`of\``, method)
  }

  return chosen
}
