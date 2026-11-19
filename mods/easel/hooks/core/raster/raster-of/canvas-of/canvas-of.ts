import Lists from '../../../lists'
import type Shapes from '../../../shapes'
import type Types from '../../types'
import { BLANK_CELL } from './blank-cell'

/**
 * Blank cells, as many rows and columns as the scene has, behind the only
 * ways to read and to write them.
 *
 * The cells are one list, row after row, made here and written only here,
 * so that no painter holds them. A place off the canvas, or between two
 * cells, reads as nothing and takes no cell.
 *
 * @param scene the size to paint in
 * @returns the ways to read a cell, to put one and to read every row
 */
export function canvasOf(scene: Shapes.Scene): Types.Canvas {
  const cells = Array.from(
    { length: scene.rows * scene.columns },
    () => BLANK_CELL,
  )

  function indexOf(at: Shapes.Point): number {
    const isInAColumn =
      Number.isInteger(at.x) &&
      Number.isInteger(at.y) &&
      at.x >= 0 &&
      at.x < scene.columns

    return isInAColumn ? at.y * scene.columns + at.x : -1
  }

  return {
    cellAt: at => cells[indexOf(at)],
    set: (at, cell) => {
      const index = indexOf(at)
      const isOnCanvas = cells[index] !== undefined

      if (isOnCanvas) {
        cells[index] = cell
      }
    },
    rows: () =>
      Lists.indexesBelow(scene.rows).map(row =>
        cells.slice(row * scene.columns, (row + 1) * scene.columns),
      ),
  }
}
