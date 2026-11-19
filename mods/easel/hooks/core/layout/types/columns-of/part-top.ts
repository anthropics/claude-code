import type Shapes from '../../../shapes'

/**
 * The top of one part of a column: its place in cells, the value that it
 * stands for and what it is drawn in.
 */
export type PartTop = {
  x: number
  y: number
  position: number
  ink: Shapes.Ink
}
