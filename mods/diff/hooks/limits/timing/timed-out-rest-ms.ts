/**
 * How long a read caused by an edit, a command or a HEAD move waits after a
 * read that got nothing because git timed out. It doubles with each timeout
 * in a row, up to TIMED_OUT_REST_MAX_MS.
 */
export const TIMED_OUT_REST_MS = 10_000
