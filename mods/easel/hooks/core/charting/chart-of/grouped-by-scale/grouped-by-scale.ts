import Forms from '../../../forms'
import Lists from '../../../lists'
import type Types from '../../types'

/**
 * A series of zeros has no size: it joins the smallest group of its unit.
 *
 * Only the newest group of a unit can take a series: each older one was
 * already too large for the series that opened the newest. A group's number
 * is how many were opened before it, so the groups come out in that order.
 *
 * @param largestFirst the series to draw, from the largest down
 * @param fitsAnySize whether one scale can show sizes far apart
 * @returns the series of each plot
 */
export function groupedByScale(
  largestFirst: Types.SizedSeries[],
  fitsAnySize: boolean,
): Types.SizedSeries[][] {
  const largestOfGroups: Types.SizedSeries[] = []
  const newestGroupOf = new Map<Types.SizedSeries['unit'], number>()
  const groupOfSeries: number[] = []

  for (const series of largestFirst) {
    const group = newestGroupOf.get(series.unit) ?? largestOfGroups.length
    const largest = largestOfGroups[group]
    const isOnTheScale =
      largest !== undefined &&
      (fitsAnySize ||
        series.size === 0 ||
        largest.size <= series.size * Forms.MAX_SCALE_RATIO)

    if (isOnTheScale) {
      groupOfSeries.push(group)
    } else {
      newestGroupOf.set(series.unit, largestOfGroups.length)
      groupOfSeries.push(largestOfGroups.length)
      largestOfGroups.push(series)
    }
  }

  return [
    ...Lists.groupBy(
      Lists.zip(largestFirst, groupOfSeries),
      placed => placed[1],
    ).values(),
  ].map(group => group.map(placed => placed[0]))
}
