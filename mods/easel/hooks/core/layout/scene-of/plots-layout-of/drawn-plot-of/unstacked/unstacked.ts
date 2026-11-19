import type Types from '../../../../types'

/**
 * Takes y as the top of a part, lowest row first. Gives y as its height.
 *
 * @param rows the series of a plot, stacked
 * @returns the same series, each with its own values
 */
export function unstacked(rows: Types.PlotRows): Types.PlotRows {
  const topBelowAt = new Map<number, number>()
  const unstackedRows: Types.PlotRows = []

  for (const row of rows) {
    unstackedRows.push({
      ...row,
      stretches: row.stretches.map(stretch =>
        stretch.map(sample => ({
          x: sample.x,
          y: sample.y - (topBelowAt.get(sample.x) ?? 0),
        })),
      ),
    })

    for (const sample of row.stretches.flat()) {
      topBelowAt.set(sample.x, sample.y)
    }
  }

  return unstackedRows
}
