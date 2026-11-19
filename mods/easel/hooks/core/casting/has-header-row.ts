import { cellKindOf } from './cell-kind-of'
import type Types from './types'

/**
 * A name of a kind that its column lacks is a header too: `hour,200,404`.
 *
 * @param columns the first row taken as names, over the rows beneath it
 * @returns whether that first row reads as a header
 */
export const hasHeaderRow = (columns: Types.Column[]): boolean =>
  columns.every(column => cellKindOf(column.name) === 'text') ||
  columns.some(
    column =>
      column.name !== '' && !column.cellsByKind.has(cellKindOf(column.name)),
  )
