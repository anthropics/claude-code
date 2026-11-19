import type Cells from '../../cells'
import type { CellKind } from './cell-kind'

/**
 * One name of the header with the cells under it, grouped by what they read
 * as.
 */
export type Column = {
  name: string
  cells: Cells.Cell[]
  cellsByKind: Map<CellKind, Cells.Cell[]>

  /**
   * The kind of all cells that are not empty, where they share one kind.
   */
  soleKind?: CellKind
}
