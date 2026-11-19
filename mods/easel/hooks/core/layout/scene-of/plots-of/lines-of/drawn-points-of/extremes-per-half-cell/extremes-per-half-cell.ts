import Lists from '../../../../../../lists'
import type Shapes from '../../../../../../shapes'
import Limits from '../../../../../limits'

/**
 * No surface shows more, so a scene's size follows its width, not the data.
 *
 * @param stretch the points of a line, in cells
 * @returns its first, lowest, highest and last point in each half cell
 */
export const extremesPerHalfCell = (stretch: Shapes.Point[]): Shapes.Point[] =>
  [
    ...Lists.groupBy(stretch, point =>
      Math.floor(point.x / Limits.HALF_CELL),
    ).values(),
  ].flatMap(points => {
    const byHeight = points.toSorted((one, other) => one.y - other.y)
    const extremes = [points[0], byHeight[0], byHeight.at(-1), points.at(-1)]

    return points.filter(point => extremes.includes(point))
  })
