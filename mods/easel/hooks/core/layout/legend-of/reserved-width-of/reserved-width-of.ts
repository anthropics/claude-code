import Limits from '../../limits'
import { maxWidthOf } from '../../max-width-of'
import type Types from '../../types'

/**
 * Measures the room that a stat after the names must leave them: the widest
 * name or its share of the width, and no less than a name beside the lane.
 *
 * @param basis the names, the lane and the blank that stands in for a name
 * @param columns the width of the whole legend, in cells
 * @returns the width that the names, and the lane if one is wanted, keep
 */
export const reservedWidthOf = (
  basis: Types.LegendBasis,
  columns: number,
): number =>
  Math.max(
    Math.min(
      basis.isNamedInHeader ? basis.indent : maxWidthOf(basis.fullNames),
      columns * Limits.MAX_NAME_SHARE,
    ),
    basis.lane.minWidth > 0 ? Limits.MIN_NAME_WIDTH + basis.lane.minWidth : 0,
  )
