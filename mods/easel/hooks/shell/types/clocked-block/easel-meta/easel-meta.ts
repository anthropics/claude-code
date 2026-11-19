import type { StoredClock } from '../../clock-of-call'

/**
 * What the mod keeps beside the words of a chart call's result.
 */
export type EaselMeta = {
  /**
   * The time and the zone that the chart was drawn with.
   */
  easel: StoredClock
}
