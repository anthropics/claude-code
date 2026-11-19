import { plainTypeOf } from './plain-type-of'

/**
 * Tells an integer and `null` apart from what `typeof` says of them.
 *
 * @param value anything that a call may hold, save an array
 * @returns `integer`, `null`, or what `typeof` says
 */
export const scalarTypeOf = (value: unknown): string =>
  Number.isInteger(value) ? 'integer' : plainTypeOf(value)
