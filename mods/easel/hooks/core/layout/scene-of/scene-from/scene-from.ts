import type Shapes from '../../../shapes'
import type Types from '../../types'

/**
 * The scene of a width, put together from everything that was laid.
 *
 * @param columns the width that was filled, in cells
 * @param laid every shape in the order to paint, and the count of rows
 * @returns the scene for a painter
 */
export const sceneFrom = (columns: number, laid: Types.Laid): Shapes.Scene => ({
  columns,
  rows: laid.rows,
  shapes: laid.shapes,
})
