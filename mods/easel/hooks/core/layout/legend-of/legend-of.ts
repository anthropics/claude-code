import Lists from '../../lists'
import Limits from '../limits'
import { maxWidthOf } from '../max-width-of'
import type Types from '../types'
import { hasDistinctNames } from './has-distinct-names'
import { isStatFitting } from './is-stat-fitting'
import { legendBasisOf } from './legend-basis-of'
import { legendWith } from './legend-with'
import { reservedWidthOf } from './reserved-width-of'
import { statColumnsOf } from './stat-columns-of'

/**
 * Nothing reaches past `columns`. A stat that does not fit is left off whole,
 * from the last one, and so is one beside which two names would be cut alike.
 *
 * The lane takes what is left, or is dropped under its least width. A name that
 * the header shows is not repeated: a blank stands in, as far as `left`.
 * Names that are cut alike take the room of the last stats, one at a time.
 *
 * @param needs the rows, the width, their lane, the header's texts, the left
 * @returns where every part of every row stands
 */
export function legendOf(needs: Types.LegendNeeds): Types.Legend {
  const basis = legendBasisOf(needs)
  const fittingStats = statColumnsOf(needs.rows).filter(
    isStatFitting(
      basis,
      Math.min(maxWidthOf(basis.fullNames), Limits.MIN_NAME_WIDTH),
      reservedWidthOf(basis, needs.columns),
    ),
  )

  return (
    Lists.indexesBelow(
      Math.max(0, fittingStats.length - needs.lane.statsBeforeNames) + 1,
    )
      .map(droppedCount =>
        legendWith(
          basis,
          fittingStats.slice(0, fittingStats.length - droppedCount),
        ),
      )
      .find(hasDistinctNames(new Set(basis.fullNames).size)) ??
    legendWith(basis, fittingStats)
  )
}
