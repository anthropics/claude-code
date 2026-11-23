/**
 * A byte order mark, and terminal colour codes such as `ESC[1;32m`. A code
 * that can stand inside a key must be known to `mayHoldMetrics` too.
 */
export const INVISIBLE_CODES = /^\uFEFF|\u001B\[[0-9;]*m/g
