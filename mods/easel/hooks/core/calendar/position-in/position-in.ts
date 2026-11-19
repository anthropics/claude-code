import type { Timeline } from '../../reading/types/timeline/timeline'
import { placeAlong } from './place-along'
import { placeAmong } from './place-among'

/**
 * Periods are equally wide, February as March. Before the first: below 0.
 *
 * Most instants are starts themselves, and the map saves them the search.
 *
 * @param timeline the ends of the axis, and the first instant of each period
 * @returns a function from an instant to its place, 0 to 1 inside the ends
 */
export function positionIn(timeline: Timeline): (ms: number) => number {
  const hasPeriods = timeline.periodStarts.length > 0

  return hasPeriods
    ? placeAmong(
        timeline,
        new Map(timeline.periodStarts.map((ms, index) => [ms, index])),
      )
    : placeAlong(timeline.axisSpan)
}
