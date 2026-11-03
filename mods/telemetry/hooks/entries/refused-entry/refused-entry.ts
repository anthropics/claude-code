/**
 * The error a refused entry rejects with: its message names the method and
 * what was wrong, and `what` is that reason alone, for a hook to answer as
 * its `{ deny }`.
 */
export type RefusedEntry = Error & { readonly what: string }
