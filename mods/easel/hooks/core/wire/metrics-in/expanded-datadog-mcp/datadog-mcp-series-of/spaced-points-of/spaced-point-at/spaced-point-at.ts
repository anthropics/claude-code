/**
 * Values that come at one interval each take the time of their place.
 *
 * @param startMs the instant of the first value
 * @param intervalMs the time from one value to the next
 * @returns what makes a point of a value and its place among the values
 */
export const spacedPointAt =
  (startMs: number, intervalMs: number) =>
  (value: string, index: number): unknown[] => [
    startMs + index * intervalMs,
    value,
  ]
