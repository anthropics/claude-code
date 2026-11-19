import type Shapes from '../../../../shapes'
import type Types from '../../../types'
import { lineOf } from '../line-of'
import { drawnPointsOf } from './drawn-points-of'
import { withoutInvisibleGaps } from './without-invisible-gaps'

/**
 * Draws each series as lines through its samples, a lone sample as a dash.
 *
 * The first series is added last, so that it shows where lines meet. A sample
 * with no neighbour is a dash: a dot would be lost on a screen.
 *
 * @param series the series, their area, the way to a sample's place
 * @returns the shapes, in the order to paint them
 */
export function linesOf({
  rows,
  area,
  toCells,
}: Types.SeriesToLay): Shapes.Shape[] {
  const lines: Shapes.Shape[] = []

  for (const row of rows.toReversed()) {
    for (const stretch of withoutInvisibleGaps(
      row.stretches.map(samples => samples.map(toCells)),
    )) {
      lines.push(lineOf(drawnPointsOf(stretch, area), row.ink))
    }
  }

  return lines
}
