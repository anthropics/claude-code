import Lists from '../../../../../../lists'
import type Types from '../../../../../types'
import { areJoinableIn } from './are-joinable-in'
import { hasHeaderOfTexts } from './has-header-of-texts'
import { hasTextIn } from './has-text-in'
import { isColumnIn } from './is-column-in'

/**
 * Joins the spans that a single space inside a column has parted.
 *
 * They are a span with no name or no cells, two spans of texts (`New York`
 * over `Cape Town`), and every pair where only wider gaps are certain to
 * part columns.
 *
 * @param fields the spans between unused positions, from left to right
 * @param rows the lines that are not rules, the first maybe a header
 * @param rules the lines that are rules
 * @returns the spans of the columns
 */
export function columnsOfFields(
  fields: Types.Field[],
  rows: string[],
  rules: string[],
): Types.Field[] {
  const hasText = hasTextIn(rows)
  const isColumn = isColumnIn(rows, fields, hasHeaderOfTexts(rows))
  const areJoinable = areJoinableIn(rows, rules)
  const narrowGaps = Lists.zip(fields, fields.slice(1)).filter(
    ([left, right]) => left.until === right.from - 1,
  )
  const hasOnlyWideGaps =
    narrowGaps.length < fields.length - 1 &&
    narrowGaps.every(([left, right]) => areJoinable(left, right))
  const columns: Types.Field[] = []

  for (const field of fields) {
    const column = columns.at(-1)
    const isSameColumn =
      column &&
      areJoinable(column, field) &&
      (hasOnlyWideGaps ||
        !isColumn(column) ||
        !isColumn(field) ||
        (hasText(column) && hasText(field)))

    isSameColumn ? (column.until = field.until) : columns.push({ ...field })
  }

  return columns
}
