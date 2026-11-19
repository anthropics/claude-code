/**
 * What `typeof` says of a value, save that `null` is told apart from an
 * object.
 *
 * @param value anything that a call may hold
 * @returns `null` for null, and otherwise what `typeof` says
 */
export const plainTypeOf = (value: unknown): string =>
  value === null ? 'null' : typeof value
