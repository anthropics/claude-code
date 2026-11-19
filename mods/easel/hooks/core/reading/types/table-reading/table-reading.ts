import type { Cell } from '../../../cells/types/cell'
import type { CellReading } from '../cell-reading'
import type { DroppedColumn } from '../dropped-column'

/**
 * Everything read from one table, before any of it is refused or drawn.
 */
export type TableReading = {
  readings: CellReading[]

  /**
   * By y column, distinct. A drawable column has at most one.
   */
  units: Map<string, string[]>

  /**
   * What all series have in common, for the header. A label may be empty.
   */
  sharedLabels: string[]

  droppedColumns: DroppedColumn[]

  /**
   * The cells of x that hold something other than a time. Bars have none.
   */
  unreadXCells: Cell[]
}
