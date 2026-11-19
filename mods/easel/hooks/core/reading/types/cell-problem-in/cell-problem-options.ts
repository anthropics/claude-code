import type CoreCall from '../../../call'
import type Casting from '../../../casting'
import type { Series } from '../series'
import type { TableReading } from '../table-reading'

/**
 * What `cellProblemIn` looks for a problem in.
 */
export type CellProblemOptions = {
  reading: TableReading
  roles: Casting.Roles
  request: CoreCall.ChartRequest
  series: Series[]
}
