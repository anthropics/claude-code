/**
 * Asks of an instant whether a walk of the calendar stops on it.
 *
 * @param starts every instant the walk stops on
 * @returns a test of one instant against them
 */
export const isStartIn =
  (starts: ReadonlySet<number>) =>
  (ms: number): boolean =>
    starts.has(ms)
