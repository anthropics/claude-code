import type { Caught } from 'claude-code'

import { REFUSED } from '../refused'

/**
 * The gate's `.catch`: a gate that threw before going on refuses the call;
 * a refusal from beneath (a malformed entry) is passed up as it is.
 *
 * @param e the entry as the caller passed it
 * @param next the replay-safe continuation the catch is handed
 * @returns beneath's own answer replayed, or the refusal
 */
export const caught = <E, R>(e: E, next: ((e: E) => R) & Caught) =>
  next.called ? next(e) : REFUSED
