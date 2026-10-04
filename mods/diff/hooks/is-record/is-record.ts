/**
 * Whether a value is a plain object that can be read field by field.
 *
 * @param value anything a tool result may be
 * @returns whether it is a non-null, non-array object
 */
export const isRecord = (value: unknown): value is Record<string, unknown> =>
  typeof value === 'object' && value !== null && !Array.isArray(value)
