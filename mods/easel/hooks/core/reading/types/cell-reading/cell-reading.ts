/**
 * One measured cell of one row, with the time and the labels of its row.
 */
export type CellReading = {
  ms: number
  isZoned: boolean
  column: string

  /**
   * The labels that tell the series of this cell from the other series.
   */
  groupLabels: string[]

  /**
   * Null if the cell is empty or could not be read.
   */
  value: number | null

  /**
   * What the cell itself says its number is in.
   */
  unit: string | null
}
