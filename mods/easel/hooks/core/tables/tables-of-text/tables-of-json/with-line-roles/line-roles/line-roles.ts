import type Casting from '../../../../../casting'
import type Wire from '../../../../../wire'

/**
 * The roles that a table of measured points states for itself: a line.
 *
 * @param metrics the answer of a service, which names the keys of its values
 * @param labelColumns the columns that are labels of a series
 * @returns the roles, with `time` as the x axis
 */
export const lineRoles = (
  metrics: Wire.Metrics,
  labelColumns: string[],
): Casting.Roles => ({
  form: 'line',
  x: 'time',
  y: metrics.y,
  by: labelColumns,
})
