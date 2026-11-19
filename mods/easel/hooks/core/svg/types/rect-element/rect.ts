import type Shapes from '../../../shapes'

/**
 * The top left corner and the size, in cells.
 */
export type Rect = {
  x: number
  y: number
  width: number
  height: number
  ink: Shapes.Ink
}
