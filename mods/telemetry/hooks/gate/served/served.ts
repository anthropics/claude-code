import type { GateNext } from '../gate-next'
import { officialIdOf } from '../official-id-of'
import { REFUSED } from '../refused'
import { SERVED_TIERS } from '../served-tiers'

/**
 * The gate on `telemetry.log` and `telemetry.mark`: a caller seated in
 * SERVED_TIERS goes on beneath, and so does an official plugin's row or
 * mark; any other is REFUSED, and no origin throws.
 *
 * @param e the entry as the caller passed it
 * @param next the hooks beneath, carrying who raised the call
 * @returns what beneath answers, or the refusal
 */
export function served<E extends object, R>(
  e: E,
  next: GateNext<E, R>,
): R | typeof REFUSED {
  if (next.origin?.tier === undefined) {
    throw new Error('$.telemetry: the call names no origin')
  }

  const isOfficialRow =
    officialIdOf(next.origin) !== undefined &&
    !('to' in e && e.to === 'collector')

  return SERVED_TIERS.includes(next.origin.tier) || isOfficialRow
    ? next(e)
    : REFUSED
}
