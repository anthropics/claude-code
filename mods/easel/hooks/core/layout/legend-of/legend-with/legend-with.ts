import Lists from '../../../lists'
import Texts from '../../../texts'
import Limits from '../../limits'
import { maxWidthOf } from '../../max-width-of'
import type Types from '../../types'
import { maxNameWidthOf } from './max-name-width-of'

/**
 * Stands the key, the names, the lane and the given stats in the width.
 *
 * The lane takes what the stats and the names leave, or is dropped under
 * its least width. The names are cut to their room, each kept distinct
 * where it can be.
 *
 * @param basis the rows, their lane, their names and the widths that stay
 * @param statColumns the stats to show, each with where it ends
 * @returns where every part of every row stands
 */
export function legendWith(
  basis: Types.LegendBasis,
  statColumns: Types.StatColumn[],
): Types.Legend {
  const wantsLane = basis.lane.minWidth > 0
  const freeWidth = basis.widthPastKey - (statColumns.at(-1)?.end ?? 0)
  const hasLane =
    wantsLane && freeWidth >= Limits.MIN_NAME_WIDTH + basis.lane.minWidth
  const names = Texts.truncateDistinct(
    basis.fullNames,
    maxNameWidthOf(freeWidth, basis.lane, hasLane),
  )
  const nameWidth = basis.isNamedInHeader
    ? Math.min(basis.indent, freeWidth)
    : maxWidthOf(names)
  const laneWidth = hasLane ? freeWidth - nameWidth - Limits.WORD_GAP : 0
  const statsAfter =
    basis.keyWidth + nameWidth + (hasLane ? Limits.WORD_GAP + laneWidth : 0)

  return {
    wantsLane,
    keyWidth: basis.keyWidth,
    shownNames: new Map(Lists.zip(basis.rows, names)),
    laneLeft: basis.keyWidth + nameWidth + Limits.WORD_GAP,
    laneWidth,
    statsLeft: statsAfter > 0 ? statsAfter + Limits.COLUMN_GAP : 0,
    statColumns,
  }
}
