import type Shapes from '../../../shapes'
import type { CanvasCell } from '../canvas-cell'

/**
 * The cells that the terminal painter fills, reached by column and row.
 *
 * It keeps its rows to itself: a painter reads and writes one cell at a
 * time, and the rows are read whole once every shape is painted.
 */
export type Canvas = {
  /**
   * Reads what a place holds, or nothing where the place is off the canvas.
   */
  cellAt: (at: Shapes.Point) => CanvasCell | undefined

  /**
   * Puts a cell at a place. A place off the canvas is ignored.
   */
  set: (at: Shapes.Point, cell: CanvasCell) => void

  /**
   * Everything painted so far, the top row first.
   */
  rows: () => readonly (readonly CanvasCell[])[]
}
