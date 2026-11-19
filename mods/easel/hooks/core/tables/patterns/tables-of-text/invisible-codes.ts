/**
 * A byte order mark, and terminal colour codes such as `ESC[1;32m`.
 */
export const INVISIBLE_CODES = /^\uFEFF|\u001B\[[0-9;]*m/g
