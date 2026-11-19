import type Types from '../../../../../../types'
import { textsIn } from '../texts-in'

/**
 * A column holds cells, and a name where the lines have a header.
 *
 * The first span needs no name: an index is often left without one.
 *
 * @param rows the lines that are not rules, the first maybe a header
 * @param fields the spans between unused positions, from left to right
 * @param hasHeader whether the first line holds only texts
 * @returns the test of whether a span is a column by itself
 */
export const isColumnIn =
  (rows: string[], fields: Types.Field[], hasHeader: boolean) =>
  (field: Types.Field): boolean => {
    const [name = '', ...cells] = textsIn(rows, field)

    return (
      (name.trim() !== '' || !(hasHeader && field.from !== fields[0]?.from)) &&
      cells.join('').trim() !== ''
    )
  }
