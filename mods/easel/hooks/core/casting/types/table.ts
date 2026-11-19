import type Cells from '../../cells'
import type { Roles } from './roles'

/**
 * What a text or a value was read into: named columns over rows of cells.
 *
 * It and its limits are declared here, beside the roles: declared with the
 * code that reads a table, they would close an import loop.
 */
export type Table = {
  /**
   * A word of this plugin, never of the data.
   */
  source: string

  /**
   * Where records lie inside other JSON: keys of the data.
   */
  path?: string

  columns: string[]
  rows: Cells.Cell[][]

  /**
   * Stated by a metrics format for its own columns.
   */
  roles?: Roles

  /**
   * Stated by a metrics service: its values are measures over time.
   */
  isSeries?: boolean

  /**
   * Stated by a metrics service: each value is whole at its time.
   */
  isReadAtInstants?: boolean

  /**
   * The columns whose cells are lists of records or lists. They are not read.
   */
  listColumns?: string[]

  unparsedLines?: number
  hasMadeUpNames: boolean

  /**
   * True for the empty placeholder of a text that the host truncated.
   */
  isCut: boolean
}
