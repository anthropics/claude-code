import Lists from '../../../lists'
import type Types from '../../types'

/**
 * What a list of series was read as, with one record per point of those
 * series that are to give points.
 *
 * @param source the format the series were read as
 * @param seriesList the series read, which name the keys that hold a value
 * @param pointedSeries those of the series whose points are made
 * @returns the keys, and a record of labels and cells per point
 */
export const pointedMetrics = (
  source: Types.MetricSource,
  seriesList: Types.Series[],
  pointedSeries: Types.Series[],
): Types.Metrics => ({
  source: source.name,
  y: Lists.distinct(seriesList.flatMap(series => series.y)),
  points: pointedSeries.flatMap(series =>
    Lists.indexesBelow(series.pointCount).map(pointIndex =>
      Object.fromEntries([
        ...series.labels,
        ...series.cellsByKey.map(([key, cells]) => [key, cells[pointIndex]]),
      ]),
    ),
  ),
  isSeries: true,
  isReadAtInstants: source.isReadAtInstants,
})
