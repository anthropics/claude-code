/**
 * Every string a value holds, however deep.
 *
 * @param value a call's input, or a part of it
 * @returns the strings
 */
export const stringsOf = (value: unknown): string[] =>
  typeof value === 'string'
    ? [value]
    : typeof value === 'object' && value !== null
      ? Object.values(value).flatMap(stringsOf)
      : []
