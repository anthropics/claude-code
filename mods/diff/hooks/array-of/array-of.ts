/**
 * A value a tool stored as the array it is, or an empty one when it is
 * anything else.
 *
 * @param value a field of a tool's input or result
 * @returns the array's items, unknown each
 */
export const arrayOf = (value: unknown): readonly unknown[] =>
  Array.isArray(value) ? value : []
