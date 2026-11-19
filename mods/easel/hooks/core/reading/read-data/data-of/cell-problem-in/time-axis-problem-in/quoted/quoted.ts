import type Cells from '../../../../../../cells'
import Lists from '../../../../../../lists'
import Limits from '../../../../../limits'

/**
 * The first few distinct values, as a refusal shows them.
 *
 * @param cells what could not be read
 * @returns the values, with commas between
 */
export const quoted = (cells: Cells.Cell[]): string =>
  Lists.distinct(cells).slice(0, Limits.MAX_UNREAD_CELLS_QUOTED).join(', ')
