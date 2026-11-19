import Limits from '../../../limits'
import type Types from '../../../types'

/**
 * Measures the room of the names: all that is free, or beside a lane their
 * share of it, and no more than leaves the lane its least width.
 *
 * @param freeWidth the width that the stats leave past the key
 * @param lane the lane that the rows want
 * @param hasLane whether the lane is shown
 * @returns the width that no shown name passes
 */
export const maxNameWidthOf = (
  freeWidth: number,
  lane: Types.Lane,
  hasLane: boolean,
): number =>
  hasLane
    ? Math.min(
        Math.floor(freeWidth / Limits.NAME_AND_LANE_SHARES),
        freeWidth - lane.minWidth - Limits.WORD_GAP,
      )
    : freeWidth
