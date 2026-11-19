import Casting from '../../../../casting'
import Lists from '../../../../lists'
import { cellsUnder } from '../../../cells-under'
import type Types from '../../../types'
import { flattenedRecord } from './flattened-record'

/**
 * Flattens each row to its leaves; the columns are every leaf's, in order.
 *
 * The points of a series share its labels, so leaves can outgrow the text:
 * their count is checked as it grows.
 *
 * @param records the records, each one a row
 * @param source the name the table carries as its source
 * @param path the keys that lead to the records, joined by dots, if any
 * @returns the one table, or none where it is too large
 */
export function tablesOfRecords(
  records: object[],
  source: string,
  path?: string,
): Casting.Table[] {
  const leavesOfRecords: Types.Leaf[][] = []
  let leafCount = 0

  for (const record of records) {
    const leaves = flattenedRecord(record, '')
    leavesOfRecords.push(leaves)
    leafCount += leaves.length
    const hasTooManyLeaves = Casting.isTooLarge(1, leafCount)

    if (hasTooManyLeaves) {
      return []
    }
  }

  const allLeaves = leavesOfRecords.flat()
  const columns = Lists.distinct(allLeaves.map(leaf => leaf.column))
  const isOversized = Casting.isTooLarge(columns.length, records.length)

  if (isOversized) {
    return []
  }

  const rows = leavesOfRecords.map(leaves =>
    cellsUnder(columns, new Map(leaves.map(leaf => [leaf.column, leaf.cell]))),
  )
  const listColumns = Lists.distinct(
    allLeaves.filter(leaf => leaf.isList).map(leaf => leaf.column),
  )

  return [
    {
      source,
      path,
      columns,
      rows,
      listColumns,
      hasMadeUpNames: false,
      isCut: false,
    },
  ]
}
