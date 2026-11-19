import ColumnSummary from '../../../column-summary'
import Reading from '../../../reading'
import Limits from '../../limits'

/**
 * The reason, the columns, and each table's name and count of columns cut.
 */
export const MAX_REFUSAL_LINES =
  1 +
  ColumnSummary.MAX_COLUMNS_LISTED +
  Limits.LINES_PER_TABLE_SUMMARIZED * Reading.MAX_TABLES_SUMMARIZED
