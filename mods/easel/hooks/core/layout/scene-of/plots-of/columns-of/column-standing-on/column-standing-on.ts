import type Shapes from '../../../../../shapes'
import Limits from '../../../../limits'
import type Types from '../../../../types'
import { raisedToMinInk } from './raised-to-min-ink'
import { stackOf } from './stack-of'

/**
 * Stacks the parts of one period into a column that stands on the foot.
 *
 * A part counts by its value: in cells, a part may be too low to differ from
 * none. A stack too low to see is raised to `MIN_INK`.
 *
 * @param foot the y that every column stands on, in cells
 * @param area where the plots stand: it holds how wide a column is, in cells
 * @returns the way from a period's left side and its tops to its column
 */
export const columnStandingOn =
  (foot: number, area: Types.PlotArea) =>
  ([left, periodTops]: [number, Types.PartTop[]]): Shapes.Shape => {
    const parts: Types.StackPart[] = []
    let below = { y: foot, position: 0 }

    for (const partTop of periodTops) {
      if (partTop.position > below.position) {
        parts.push({ height: below.y - partTop.y, ink: partTop.ink })
      }

      below = partTop
    }

    return stackOf(
      { x: left, y: foot },
      area,
      foot - below.y < Limits.MIN_INK ? raisedToMinInk(parts) : parts,
    )
  }
