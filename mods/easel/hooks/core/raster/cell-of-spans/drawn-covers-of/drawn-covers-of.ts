import Limits from '../../limits'
import type Types from '../../types'

/**
 * The two largest covers, in the order that their parts stand in.
 *
 * @param everyCover the covers of one cell, in the order of their parts
 * @param bySize the same covers, the largest first
 * @returns the covers whose inks the cell shows
 */
export const drawnCoversOf = (
  everyCover: Types.Cover[],
  bySize: Types.Cover[],
): Types.Cover[] =>
  everyCover.filter(cover =>
    bySize.slice(0, Limits.INKS_PER_CELL).includes(cover),
  )
