import Limits from '../../../limits'
import Patterns from '../../../patterns'
import type Types from '../../../types'
import { timeAt } from '../../time-at'

/**
 * Shifts a wall clock's reading by the zone and the fraction read beside it.
 *
 * `Z`, `UTC`, `GMT` and no zone do not match the offset, and are no minutes
 * ahead of UTC.
 *
 * @param wallMs the wall clock's reading in ms, as if it were UTC
 * @param parts the named groups of a matched time pattern
 * @returns the instant read
 */
export function timeOfWallClock(
  wallMs: number,
  parts: Types.MatchGroups,
): Types.TimeRead {
  const offset: Types.MatchGroups =
    Patterns.ZONE_OFFSET.exec(parts.zone ?? '')?.groups ?? {}
  const minutes =
    Number(offset.hours ?? 0) * Limits.MINUTES_PER_HOUR +
    Number(offset.minutes ?? 0)

  return timeAt(
    wallMs -
      (offset.sign === '-' ? -minutes : minutes) * Limits.MS_PER_MINUTE +
      Math.round(Number(parts.fraction ?? '0') * Limits.MS_PER_SECOND),
    parts.zone !== undefined,
  )
}
