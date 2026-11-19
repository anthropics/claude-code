import { scalarTypeOf } from './scalar-type-of'

/**
 * Tells an array, an integer and `null` apart from what `typeof` says of
 * them, as the `type` of a schema does.
 *
 * @param value anything that a call may hold
 * @returns `array`, `integer`, `null`, or what `typeof` says
 */
export const jsonTypeOf = (value: unknown): string =>
  Array.isArray(value) ? 'array' : scalarTypeOf(value)
