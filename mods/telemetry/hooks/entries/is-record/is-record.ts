/**
 * Whether the value is a plain object (not null, not an array).
 *
 * @param value what the caller passed
 * @returns whether the value is a plain object, not null and not an array
 */
export const isRecord = (value: unknown): value is Record<string, unknown> =>
  typeof value === 'object' && value !== null && !Array.isArray(value)
