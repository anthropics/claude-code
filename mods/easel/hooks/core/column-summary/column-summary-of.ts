import type Casting from '../casting'
import Limits from './limits'
import { tableLinesOf } from './table-lines-of'

/**
 * What ends a refusal: the columns that the next call can name.
 *
 * @param tables the tables that were read
 * @returns the lines, under a heading for each table where there are several
 */
export const columnSummaryOf = (tables: Casting.Table[]): string[] =>
  tables.flatMap(
    tableLinesOf(
      Math.floor(Limits.MAX_COLUMNS_LISTED / tables.length),
      tables.length > 1,
    ),
  )
