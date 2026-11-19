import type Shapes from '../../../shapes'
import type Types from '../../types'

/**
 * What one row of a legend laid: its shapes, the row below it, and where
 * its lane starts.
 *
 * @param shapes the key, the name and the stats of the row
 * @param top the row of the scene that they stand on
 * @param laneLeft the column where the lane of the legend starts
 * @returns the shapes with the next free row and the start of the lane
 */
export const laidRow = (
  shapes: Shapes.Shape[],
  top: number,
  laneLeft: number,
): Types.LaidLegendRow => ({
  shapes,
  rows: top + 1,
  lane: { x: laneLeft, y: top },
})
