import type { Method } from '../method'
import type { RefusedEntry } from '../refused-entry'

/**
 * The error a refused entry rejects with, naming the method and what was
 * wrong, the reason kept beside the message as `what`.
 *
 * The text carries a key that passed TOKEN or a status code, nothing the caller
 * wrote as free text.
 *
 * @param what the refusal, as the caller reads it
 * @param method the method refusing
 * @returns the error to reject the call with, naming the method and what was
 *          wrong
 */
export const refusal = (what: string, method: Method = 'log'): RefusedEntry =>
  Object.assign(new Error(`$.telemetry.${method}: ${what}`), { what })
