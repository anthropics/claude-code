/**
 * The longest a slow read delays the next read caused by an edit, a command
 * or a HEAD move. Timed-out reads have their own limit, TIMED_OUT_REST_MAX_MS.
 */
export const SLOW_REFRESH_REST_MAX_MS = 30_000
