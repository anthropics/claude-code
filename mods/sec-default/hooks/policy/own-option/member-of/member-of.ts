/**
 * One step into settings read as plain data: the value's own member of that
 * name, or undefined when the value is no object or holds none.
 *
 * @param value what was read so far
 * @param key the member's name
 * @returns the member, or undefined
 */
export function memberOf(value: unknown, key: string): unknown {
  const isObject = typeof value === 'object' && value !== null

  return isObject ? new Map(Object.entries(value)).get(key) : undefined
}
