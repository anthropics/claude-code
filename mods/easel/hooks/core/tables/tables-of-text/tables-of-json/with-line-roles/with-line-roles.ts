import type Casting from '../../../../casting'
import type Wire from '../../../../wire'
import { lineRoles } from './line-roles'

/**
 * States the roles of a line on a table of metrics.
 *
 * Every column that is neither the time nor a value is a label of a series.
 *
 * @param metrics the metrics the table was read from
 * @returns the step from a table to the same table with its roles
 */
export function withLineRoles(
  metrics: Wire.Metrics,
): (table: Casting.Table) => Casting.Table {
  const timeAndValues = ['time', ...metrics.y]

  return table => ({
    ...table,
    isSeries: metrics.isSeries,
    isReadAtInstants: metrics.isReadAtInstants,
    roles: lineRoles(
      metrics,
      table.columns.filter(column => !timeAndValues.includes(column)),
    ),
  })
}
