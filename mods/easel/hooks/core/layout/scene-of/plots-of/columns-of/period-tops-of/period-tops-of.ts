import Lists from '../../../../../lists'
import type Types from '../../../../types'

/**
 * The tops of the parts of every column, by the left side of their period.
 *
 * A part counts by its value: in cells, a part may be too low to differ from
 * none.
 *
 * @param series the series, their area, the way to a sample's place
 * @returns the tops of each period, the lowest series first
 */
export const periodTopsOf = (
  series: Types.SeriesToLay,
): Map<number, Types.PartTop[]> =>
  Lists.groupBy(
    series.rows.flatMap(row =>
      row.stretches.flat().map((sample): Types.PartTop => ({
        ...series.toCells(sample),
        position: sample.y,
        ink: row.ink,
      })),
    ),
    partTop => partTop.x,
  )
