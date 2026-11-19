/**
 * As if the clock showed UTC. A field past its range carries over.
 *
 * @param fields the year, then as many finer fields as are known
 * @returns the epoch milliseconds at which a UTC clock shows them
 */
export const wallClockMs = (fields: readonly number[]): number =>
  Date.UTC(fields[0] ?? 0, ...fields.slice(1))
