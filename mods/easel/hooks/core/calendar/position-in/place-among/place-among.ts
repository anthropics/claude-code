import type { Timeline } from '../../../reading/types/timeline/timeline'

/**
 * Places an instant by its period, each as wide as the next, and by its
 * share of that period.
 *
 * @param timeline the ends of the axis, and the first instant of each period
 * @param indexOfStart which period each first instant begins
 * @returns a function from an instant to its place, below 0 before the first
 */
export const placeAmong =
  (timeline: Timeline, indexOfStart: ReadonlyMap<number, number>) =>
  (ms: number): number => {
    const periodIndex =
      indexOfStart.get(ms) ??
      timeline.periodStarts.findLastIndex(start => start <= ms)
    const startMs =
      timeline.periodStarts[periodIndex] ?? timeline.axisSpan.fromMs

    return (
      (periodIndex +
        (ms - startMs) /
          ((timeline.periodStarts[periodIndex + 1] ??
            timeline.axisSpan.untilMs) -
            startMs)) /
      timeline.periodStarts.length
    )
  }
