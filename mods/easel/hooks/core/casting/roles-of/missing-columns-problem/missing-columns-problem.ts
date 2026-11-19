import type Refusal from '../../../refusal'
import type Types from '../../types'
import Words from '../../words'

/**
 * A role names a column that the table does not have. Where a metrics
 * format gave the columns, the reason says so.
 *
 * @param missing the names that no column carries
 * @param table the table that was read
 * @returns the reason to refuse
 */
export const missingColumnsProblem = (
  missing: string[],
  table: Types.Table,
): Refusal.Problem => ({
  code: 'no_such_column',
  why:
    `it has no column ${missing.join(', ')}` +
    (table.roles ? Words.METRICS_FORMAT_ADVICE : ''),
})
