import Limits from '../limits'

/**
 * How long a read caused by an edit, a command or a HEAD move waits: as long
 * as the last read's file listing took, up to SLOW_REFRESH_REST_MAX_MS, so
 * listing takes at most about half the time. After timed-out reads, at least
 * TIMED_OUT_REST_MS, doubling per timeout up to TIMED_OUT_REST_MAX_MS.
 *
 * @param tookMs how long the last read's file listing ran
 * @param timedOut how many reads in a row got nothing because git timed out
 * @returns the wait in milliseconds; 0 when the debounce already covers it
 */
export function refreshRestOf(tookMs: number, timedOut: number): number {
  const slowMs = Math.min(tookMs, Limits.SLOW_REFRESH_REST_MAX_MS)

  const timedOutMs =
    timedOut > 0
      ? Math.min(
          Limits.TIMED_OUT_REST_MS * 2 ** (timedOut - 1),
          Limits.TIMED_OUT_REST_MAX_MS,
        )
      : 0

  const restMs = Math.max(slowMs, timedOutMs)

  return restMs > Limits.REFRESH_DEBOUNCE_MS ? restMs : 0
}
