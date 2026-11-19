/**
 * How long a `vcs.detect` answer's revision stands before the poll asks
 * again: far longer than HEAD_POLL_MS, as an answer may cost a server call.
 */
export const REVISION_POLL_MS = 30_000
