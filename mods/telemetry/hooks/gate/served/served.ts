import type { GateNext } from '../gate-next'
import { REFUSED } from '../refused'
import { SERVED_TIERS } from '../served-tiers'

/**
 * The gate on `telemetry.log` and `telemetry.mark`: a caller seated in
 * SERVED_TIERS goes on beneath, any other is REFUSED; no origin throws.
 *
 * @param e the entry as the caller passed it
 * @param next the hooks beneath, carrying who raised the call
 * @returns what beneath answers, or the refusal
 */
export function served<E, R>(e: E, next: GateNext<E, R>): R | typeof REFUSED {
  if (next.origin?.tier === undefined) {
    throw new Error('$.telemetry: the call names no origin')
  }

  return SERVED_TIERS.includes(next.origin.tier) ? next(e) : REFUSED
}
