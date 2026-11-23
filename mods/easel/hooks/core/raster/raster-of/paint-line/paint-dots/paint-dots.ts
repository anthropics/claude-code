import type Shapes from '../../../../shapes'
import { GRID_CELL } from '../../../grid-cell'
import type Types from '../../../types'
import Words from '../../../words'
import { lineCellOf } from '../line-cell-of'

/**
 * A line is painted only in cells that are blank, hold the grid or hold
 * another line.
 *
 * @param canvas the cells to paint in
 * @param place the cell that the dots fall in; off the canvas, none is painted
 * @param dots the ink of the line and the bits of its new dots
 * @returns nothing
 */
export function paintDots(
  canvas: Types.Canvas,
  place: Shapes.Point,
  dots: Types.LineBits,
): void {
  const cell = canvas.cellAt(place)
  const isOpen =
    cell !== undefined &&
    (cell.glyph === Words.BLANK ||
      cell === GRID_CELL ||
      cell.lines !== undefined)

  if (isOpen) {
    canvas.set(place, lineCellOf(cell, dots))
  }
}
