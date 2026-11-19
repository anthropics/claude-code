import Calendar from '../../../core/calendar'
import Json from '../../../core/json'
import type Types from '../../types'

/**
 * A redraw must not change with the time or the machine, so it reads the
 * clock of the call. Where it was lost, there is no time and the zone is UTC,
 * as it is where this host does not know the zone.
 *
 * @param storedResult the result of a chart call as the host stored it
 * @returns the time and the zone that the chart was first drawn with
 */
export function clockOfCall(storedResult: unknown): Types.StoredClock {
  const [clock] = Json.valuesAt(storedResult, '0._meta.easel')
  const stored = Json.isRecord(clock) ? clock : {}
  const nowMs = typeof stored.nowMs === 'number' ? stored.nowMs : null
  const zone = typeof stored.zone === 'string' ? stored.zone : 'UTC'

  try {
    Calendar.formatterOf(zone)

    return { nowMs, zone }
  } catch (error) {
    if (error instanceof RangeError) {
      return { nowMs, zone: 'UTC' }
    }
    throw error
  }
}
