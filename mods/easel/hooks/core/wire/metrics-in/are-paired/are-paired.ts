import type Types from '../../types'

/**
 * A point takes one cell of every key, so a series with a time too few or
 * a value too many cannot be read as points.
 *
 * @param seriesList the series read as one format writes them
 * @returns whether every key of every series has a cell for each point
 */
export const arePaired = (seriesList: Types.Series[]): boolean =>
  seriesList.every(series =>
    series.cellsByKey.every(([, cells]) => cells.length === series.pointCount),
  )
