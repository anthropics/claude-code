import { cellOf } from '../../../../cell-of'
import type Types from '../../../../types'
import { leafOf } from './leaf-of'
import { listLeafOf } from './list-leaf-of'

/**
 * A list of records or lists is not read.
 *
 * It keeps a column with an empty cell, so that the row is not taken for
 * less than it is.
 *
 * @param record a record, or one nested in a record
 * @param prefix the keys that lead to it, each followed by a dot
 * @returns its leaves, in the order of its keys
 */
export const flattenedRecord = (record: object, prefix: string): Types.Leaf[] =>
  Object.entries(record).flatMap(([key, value]): Types.Leaf[] => {
    const column = `${prefix}${key}`

    if (typeof value !== 'object' || value === null) {
      return [leafOf(column, cellOf(value))]
    }

    const isList =
      Array.isArray(value) &&
      value.some(item => typeof item === 'object' && item !== null)

    return isList ? [listLeafOf(column)] : flattenedRecord(value, `${column}.`)
  })
