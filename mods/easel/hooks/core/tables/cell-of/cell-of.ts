import type Cells from '../../cells'

/**
 * Texts, numbers and booleans stay; any other value is written as JSON.
 *
 * @param node a JSON value at a leaf
 * @returns the cell, null for a missing value
 */
export function cellOf(node: unknown): Cells.Cell {
  const isPlain =
    typeof node === 'string' ||
    typeof node === 'number' ||
    typeof node === 'boolean'
  const isMissing = node === undefined || node === null

  return isPlain ? node : isMissing ? null : JSON.stringify(node)
}
