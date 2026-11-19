import type Cells from '../../../cells'
import Lists from '../../../lists'
import { cellKindOf } from '../../cell-kind-of'
import type Types from '../../types'

/**
 * Sorts the cells under one name of the header by the kind they read as.
 *
 * @param name the name in the header
 * @param cells the cells under it, one for each row
 * @returns the entry for that name
 */
export function classifiedColumn(
  name: string,
  cells: Cells.Cell[],
): Types.Column {
  const cellsByKind = Lists.groupBy(cells, cellKindOf)
  const kinds = [...cellsByKind.keys()].filter(kind => kind !== 'empty')

  return {
    name,
    cells,
    cellsByKind,
    soleKind: kinds.length === 1 ? kinds[0] : undefined,
  }
}
