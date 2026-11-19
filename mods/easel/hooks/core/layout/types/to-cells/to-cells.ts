import type Shapes from '../../../shapes'

/**
 * From a sample, in shares of both axes, to its place in cells and rows.
 */
export type ToCells = (position: Shapes.Point) => Shapes.Point
